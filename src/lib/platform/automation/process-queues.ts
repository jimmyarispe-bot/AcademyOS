import type { createAuthClient } from "@/lib/supabase/server-auth";
import { processWorkflowQueue } from "@/lib/admissions/automation/queue";
import { processCommunicationQueue } from "@/lib/admissions/communications/engine";
import { syncAdmissionsQueueToPlatform } from "@/lib/platform/automation/queue";
import { syncFailedAutomationsToMissionControl } from "@/lib/platform/automation/mission-control";
import { processSpedReviewReminders } from "@/lib/sis/reminders";
import { processMedicalDocumentExpiryAlerts } from "@/lib/ssis/medical-alerts";
import { processDisengagedFamilies } from "@/lib/ssis/engagement";
import { processAttendanceParentNotifications } from "@/lib/ssis/attendance-notifications";
import { processSchedulingIntelligenceQueue } from "@/lib/scheduling/intelligence";
import { syncTeacherComplianceToMissionControl } from "@/lib/teacher/compliance";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

type NamedJob = { name: string; run: () => Promise<unknown> };

/**
 * What one nightly run actually did.
 *
 * Returned rather than discarded, because for months this function reported
 * success by returning nothing at all. The route it is called from answered
 * `{success: true}` whether every queue drained or none of them existed, and
 * there was no way — short of reading the tables by hand — to tell the two
 * apart. A job runner that cannot say what it did is indistinguishable from one
 * that does nothing.
 */
export interface PlatformQueueRunSummary {
  readonly jobsRun: number;
  readonly failures: { readonly name: string; readonly error: string }[];
  readonly durationMs: number;
}

/**
 * Run independent jobs concurrently. Failures are collected; callers still receive success
 * after best-effort processing (same jobs as before, higher throughput).
 */
async function runParallelJobs(jobs: NamedJob[]): Promise<{ name: string; error: string }[]> {
  const settled = await Promise.allSettled(jobs.map((job) => job.run()));
  const failures: { name: string; error: string }[] = [];
  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      const reason = result.reason;
      failures.push({
        name: jobs[index]!.name,
        error: reason instanceof Error ? reason.message : String(reason),
      });
    }
  });
  return failures;
}

/** Orchestrates all module queue processors — the platform job runner */
export async function processAllPlatformQueues(
  supabase: AuthClient
): Promise<PlatformQueueRunSummary> {
  const startedAt = Date.now();
  const failures: { name: string; error: string }[] = [];
  let jobsRun = 0;

  // Every wave goes through here so the counts and errors survive to the
  // caller. Failures are still collected rather than thrown — one broken
  // module must not stop the other thirty from running — but they are no
  // longer silently dropped on the floor.
  const run = async (jobs: NamedJob[]) => {
    jobsRun += jobs.length;
    failures.push(...(await runParallelJobs(jobs)));
  };
  // Wave 1 — independent domain processors (no cross-job ordering requirements).
  await run([
    { name: "admissions.workflow", run: () => processWorkflowQueue(supabase) },
    { name: "admissions.communication", run: () => processCommunicationQueue(supabase) },
    { name: "admissions.syncPlatform", run: () => syncAdmissionsQueueToPlatform(supabase) },
    { name: "automation.missionControl", run: () => syncFailedAutomationsToMissionControl(supabase) },
    { name: "sis.spedReminders", run: () => processSpedReviewReminders(supabase) },
    { name: "ssis.medicalAlerts", run: () => processMedicalDocumentExpiryAlerts(supabase) },
    { name: "ssis.disengagedFamilies", run: () => processDisengagedFamilies(supabase) },
    { name: "ssis.attendanceNotifications", run: () => processAttendanceParentNotifications(supabase) },
    { name: "scheduling.intelligence", run: () => processSchedulingIntelligenceQueue(supabase) },
    { name: "teacher.compliance", run: () => syncTeacherComplianceToMissionControl(supabase) },
  ]);

  // Wave 2 — ordered pairs (sync-then-process) kept sequential within each pair; pairs parallel.
  const { syncInstructionReminderJobs, processInstructionReminders } = await import(
    "@/lib/instruction/automation"
  );
  const { syncFinanceAlertsToMissionControl, processFinanceQueueJobs } = await import(
    "@/lib/finance/automation"
  );

  await run([
    {
      name: "instruction.reminders",
      run: async () => {
        await syncInstructionReminderJobs(supabase);
        await processInstructionReminders(supabase);
      },
    },
    {
      name: "finance.queue",
      run: async () => {
        await syncFinanceAlertsToMissionControl(supabase);
        await processFinanceQueueJobs(supabase);
      },
    },
  ]);

  // Wave 3 — independent platform sync jobs.
  await run([
    {
      name: "hr.compliance",
      run: async () => {
        const { syncHrComplianceToMissionControl } = await import("@/lib/hr/automation");
        return syncHrComplianceToMissionControl(supabase);
      },
    },
    {
      name: "compliance.missionControl",
      run: async () => {
        const { syncComplianceToMissionControl } = await import("@/lib/compliance/automation");
        return syncComplianceToMissionControl(supabase);
      },
    },
    {
      name: "work.missionControl",
      run: async () => {
        const { syncWorkToMissionControl } = await import("@/lib/work/automation");
        return syncWorkToMissionControl(supabase);
      },
    },
    {
      name: "financialIntelligence.sync",
      run: async () => {
        const { syncFinancialIntelligence } = await import("@/lib/financial-intelligence/automation");
        return syncFinancialIntelligence(supabase);
      },
    },
    {
      name: "edi.sync",
      run: async () => {
        const { syncExecutiveDecisionIntelligence } = await import("@/lib/edi/automation");
        return syncExecutiveDecisionIntelligence(supabase);
      },
    },
    {
      name: "enterpriseData.sync",
      run: async () => {
        const { syncEnterpriseDataPlatform } = await import("@/lib/enterprise-data/automation");
        return syncEnterpriseDataPlatform(supabase);
      },
    },
    {
      name: "intelligencePlatform.sync",
      run: async () => {
        const { syncIntelligencePlatform } = await import("@/lib/intelligence-platform/automation");
        return syncIntelligencePlatform(supabase);
      },
    },
    {
      name: "cloud.sync",
      run: async () => {
        const { syncCloudPlatform } = await import("@/lib/cloud-platform/hub");
        return syncCloudPlatform(supabase);
      },
    },
    {
      name: "certification.sync",
      run: async () => {
        const { syncCertificationPlatform } = await import("@/lib/certification/automation");
        return syncCertificationPlatform(supabase);
      },
    },
    {
      name: "integrationHub.sync",
      run: async () => {
        const { syncIntegrationHub } = await import("@/lib/integration-hub/automation");
        return syncIntegrationHub(supabase);
      },
    },
    {
      name: "operations.sync",
      run: async () => {
        const { syncOperationsPlatform } = await import("@/lib/operations-platform/hub");
        return syncOperationsPlatform(supabase);
      },
    },
    {
      name: "intelligenceNetwork.sync",
      run: async () => {
        const { syncIntelligenceNetwork } = await import("@/lib/intelligence-network/automation");
        return syncIntelligenceNetwork(supabase);
      },
    },
    {
      name: "googleWorkspace.sync",
      run: async () => {
        const { processGoogleWorkspaceSyncJobs } = await import(
          "@/lib/platform/integrations/google-workspace/sync/automation"
        );
        return processGoogleWorkspaceSyncJobs(supabase);
      },
    },
    {
      name: "microsoft365.sync",
      run: async () => {
        const { processMicrosoft365SyncJobs } = await import(
          "@/lib/platform/integrations/microsoft-365/sync/automation"
        );
        return processMicrosoft365SyncJobs(supabase);
      },
    },
  ]);

  // Wave 4 — school insights in parallel (same limit(20) set as before).
  const { generateExecutiveInsights } = await import("@/lib/executive/insights");
  const { data: schools } = await supabase.from("schools").select("id").limit(20);
  if (schools?.length) {
    await run(
      schools.map((school) => ({
        name: `executive.insights.${school.id}`,
        run: () => generateExecutiveInsights(supabase, school.id),
      }))
    );
  } else {
    // Counted too. A run with no schools still did this work, and a summary
    // that omits it would understate what happened.
    await run([
      { name: "executive.insights", run: () => generateExecutiveInsights(supabase) },
    ]);
  }

  // Wave 5 — org snapshot first (activity event), then school snapshots in parallel.
  const { captureDailyExecutiveSnapshot } = await import("@/lib/platform/kpi-snapshots");
  await run([
    {
      name: "kpi.snapshot.org",
      run: () => captureDailyExecutiveSnapshot(supabase, { recordActivityEvent: true }),
    },
  ]);
  if (schools?.length) {
    await run(
      schools.map((school) => ({
        name: `kpi.snapshot.${school.id}`,
        run: () =>
          captureDailyExecutiveSnapshot(supabase, {
            filters: { schoolId: school.id },
            recordActivityEvent: false,
          }),
      }))
    );
  }

  // Wave 6 — RC11 production readiness workers (JAG, founder, aging, certs, notifications).
  await run([
    {
      name: "rc11.productionWorkers",
      run: async () => {
        const { processRc11ProductionWorkers } = await import("@/lib/production/workers");
        return processRc11ProductionWorkers(supabase);
      },
    },
  ]);

  return { jobsRun, failures, durationMs: Date.now() - startedAt };
}
