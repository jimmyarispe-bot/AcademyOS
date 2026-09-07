import type { createAuthClient } from "@/lib/supabase/server-auth";
import { processWorkflowQueue } from "@/lib/admissions/automation/queue";
import { processCommunicationQueue } from "@/lib/admissions/communications/engine";
import { syncAdmissionsQueueToPlatform } from "@/lib/platform/automation/queue";
import { syncFailedAutomationsToMissionControl } from "@/lib/platform/automation/mission-control";
import { processParentReminders } from "@/lib/admissions/automation/parent-reminders";
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
  /**
   * How long every job took, finished or not. Without this the only jobs with a
   * time against them are the ones that hit the 12s ceiling, which tells you
   * nothing about whether they are slow or merely queueing behind thirteen
   * siblings. Measure first; the guess about which is which has been wrong once
   * already.
   */
  readonly timings: { readonly name: string; readonly ms: number; readonly ok: boolean }[];
}

/**
 * THE BUDGET, AND WHY IT EXISTS.
 *
 * This runner has thirty-odd jobs across six sequential waves. On Vercel it
 * gets 60 seconds total (the Hobby ceiling) and it was previously getting 10.
 * When the wall clock ran out the function was killed mid-flight: no response,
 * no run log, HTTP 504 returned to a scheduler with nobody to tell. That is why
 * platform_job_runs was empty and why nothing in this system has ever completed
 * a nightly run.
 *
 * A bigger number does not fix that; there isn't one on this plan. So the run
 * now lives inside a budget it enforces itself:
 *
 *   - Every job races a per-job timeout, capped by whatever is left of the
 *     budget. A wave starting at 43s cannot then run 12s more and land at 55 —
 *     which it did on 7 Sept, five seconds under a hard ceiling of 60.
 *   - Before each wave, the remaining budget is checked. Out of time means the
 *     rest are recorded as skipped rather than silently never attempted.
 *
 * RUN_BUDGET_MS is therefore a real bound on the whole run, not on when work is
 * allowed to start. That distinction is the difference between a run that
 * reports what it did and a 504 that reports nothing.
 *
 * The point is not that everything finishes. It is that the run ALWAYS returns
 * and always says what it did — so a slow job is named in the log instead of
 * taking the whole night down with it.
 */
const RUN_BUDGET_MS = 45_000;
const PER_JOB_TIMEOUT_MS = 12_000;

/**
 * HOW MANY JOBS MAY RUN AT ONCE.
 *
 * Contention is real but it is NOT the main constraint, and the measurements
 * that settled that are worth keeping because two plausible theories died here.
 *
 * The sync jobs used to fire fourteen-at-once into a single Promise.allSettled.
 * Capping them at three did help: compliance.missionControl and cloud.sync
 * started passing, having failed at fourteen. So connection-pool contention
 * exists and a cap is worth having.
 *
 * But SEVEN jobs still hit the 12s ceiling at three-wide. They are not queueing;
 * they are genuinely long. Only one of them (googleWorkspace.sync) even touches
 * the network -- it walks Google's API with an N+1 over Gmail and cannot finish
 * in twelve seconds by construction, which was already written down on 2 Sept.
 * The other six are pure database work that simply takes longer than the ceiling.
 *
 * So: keep a modest cap, because it demonstrably helps and costs nothing. Do not
 * expect it to make slow jobs fast. It cannot.
 */
const DEFAULT_CONCURRENCY = 6;
const HEAVY_SYNC_CONCURRENCY = 4;

/**
 * The underlying work is not cancelled — a promise cannot be. It is abandoned:
 * we stop waiting and record the fact. On serverless the process is frozen
 * after the response anyway, so an abandoned job simply does not finish.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

interface JobOutcome {
  name: string;
  ms: number;
  ok: boolean;
  error?: string;
}

/**
 * Run jobs through a pool of at most `concurrency` at a time, each under its own
 * clock, and time every one of them.
 *
 * Workers pull from a shared cursor rather than being handed fixed slices, so a
 * single slow job delays only itself — the other workers keep taking from the
 * queue instead of idling behind it.
 */
async function runParallelJobs(
  jobs: NamedJob[],
  concurrency: number,
  deadline: number
): Promise<JobOutcome[]> {
  const outcomes: JobOutcome[] = new Array(jobs.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      const job = jobs[index];
      if (!job) return;

      // THE PER-JOB CLOCK MUST RESPECT THE RUN'S DEADLINE, NOT JUST ITS OWN.
      //
      // The budget check happens before a WAVE starts, so it only ever bounded
      // when work began, never when it ended. On 7 Sept a wave started at ~43s,
      // one of its jobs took the full 12s, and the run finished at 55.4s -- with
      // Vercel's hard ceiling at 60. A slightly slower night crosses it, the
      // function is killed, and we are back to a 504 with no run log: exactly
      // the failure this whole budget was built to end.
      //
      // So a job gets the smaller of its own ceiling and whatever is left.
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        outcomes[index] = {
          name: job.name,
          ms: 0,
          ok: false,
          error: "skipped: no budget remaining",
        };
        continue;
      }

      const jobStartedAt = Date.now();
      try {
        await withTimeout(
          Promise.resolve(job.run()),
          Math.min(PER_JOB_TIMEOUT_MS, remaining)
        );
        outcomes[index] = { name: job.name, ms: Date.now() - jobStartedAt, ok: true };
      } catch (err) {
        outcomes[index] = {
          name: job.name,
          ms: Date.now() - jobStartedAt,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, jobs.length)) }, worker)
  );

  return outcomes;
}

/** Orchestrates all module queue processors — the platform job runner */
export async function processAllPlatformQueues(
  supabase: AuthClient
): Promise<PlatformQueueRunSummary> {
  const startedAt = Date.now();
  const failures: { name: string; error: string }[] = [];
  const timings: { name: string; ms: number; ok: boolean }[] = [];
  let jobsRun = 0;

  // Every wave goes through here so the counts and errors survive to the
  // caller. Failures are still collected rather than thrown — one broken
  // module must not stop the other thirty from running — but they are no
  // longer silently dropped on the floor.
  const run = async (jobs: NamedJob[], concurrency: number = DEFAULT_CONCURRENCY) => {
    // Out of budget: record the rest rather than starting work that will be
    // killed halfway through. A named "skipped" is information; a 504 is not.
    const elapsed = Date.now() - startedAt;
    if (elapsed > RUN_BUDGET_MS) {
      for (const job of jobs) {
        failures.push({
          name: job.name,
          error: `skipped: run budget exhausted at ${elapsed}ms`,
        });
        timings.push({ name: job.name, ms: 0, ok: false });
      }
      jobsRun += jobs.length;
      return;
    }
    jobsRun += jobs.length;

    for (const outcome of await runParallelJobs(
      jobs,
      concurrency,
      startedAt + RUN_BUDGET_MS
    )) {
      timings.push({ name: outcome.name, ms: outcome.ms, ok: outcome.ok });
      if (!outcome.ok) {
        failures.push({ name: outcome.name, error: outcome.error ?? "failed" });
      }
    }
  };
  // Wave 1 — independent domain processors (no cross-job ordering requirements).
  await run([
    { name: "admissions.workflow", run: () => processWorkflowQueue(supabase) },
    { name: "admissions.communication", run: () => processCommunicationQueue(supabase) },
    // Runs BEFORE the communication queue drains next time, not after: this
    // job only enqueues, so the messages it writes tonight are delivered on the
    // same run by processCommunicationQueue above only if it happens to run
    // later. One night of latency at worst, and never a double send.
    // Takes no client: it builds its own service-role one. See the header of
    // parent-reminders.ts -- handing it the caller's client meant every insert
    // was refused by RLS on the human path, silently.
    { name: "admissions.parentReminders", run: () => processParentReminders() },
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

  // Wave 3 — mission-control feeds. Cheap, and they are what the dashboards read.
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
  ]);

  // ---------------------------------------------------------------------------
  // ORDER IS THE POINT FROM HERE ON.
  //
  // On 7 Sept the fourteen sync jobs below ran BEFORE the snapshots and insights.
  // Seven of them hit the 12s ceiling, the wave consumed the entire 45s budget on
  // its own, and every job after it was recorded as "skipped: run budget
  // exhausted" -- including the five KPI snapshots and four executive insights,
  // which had been completing perfectly well.
  //
  // So the run spent its whole night on jobs that have never once finished, and
  // starved the ones that had. Concurrency was not the fault; ORDER was.
  //
  // Cheap work that finishes now goes first. The expensive syncs go last, where
  // being cut off costs nothing that was not already being lost -- and where the
  // "skipped" lines are an honest inventory of what does not fit rather than
  // collateral damage.
  //
  // This is a triage, NOT a fix. There is more work here than a 60-second HTTP
  // request can hold, and no ordering changes that. See the note at the bottom.
  // ---------------------------------------------------------------------------

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

  // Wave 7 — the expensive platform syncs. LAST, deliberately. Seven of these
  // exceed the per-job ceiling on their own; whatever budget remains is theirs.
  await run([
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
  ], HEAVY_SYNC_CONCURRENCY);

  // ---------------------------------------------------------------------------
  // WHAT IS STILL UNSOLVED, SO NOBODY MISTAKES THIS FOR FINISHED.
  //
  // Seven jobs each need more than the 12s per-job ceiling. That is over eighty
  // seconds of work in the slow tail alone, inside a request that gets sixty.
  // No ordering, concurrency setting or budget makes those numbers fit; ordering
  // only decides who gets starved. Right now the starved set is the jobs that
  // have never completed anyway, which is the best arrangement available but is
  // not the same as working.
  //
  // Fixing it properly means one of:
  //   * splitting the run across several schedules, so each gets its own 60s;
  //   * making the slow jobs resumable (a cursor, a few schools per run) rather
  //     than all-or-nothing -- this is what the 2 Sept note on the Google sync
  //     already concluded and it applies to the other six;
  //   * or accepting that these syncs are on-demand, not nightly, and taking
  //     them out of this path entirely.
  //
  // That is a decision about what the school needs nightly, not a code change to
  // make on someone's behalf.
  // ---------------------------------------------------------------------------

  // Slowest first — the top of this list is the whole diagnosis.
  timings.sort((a, b) => b.ms - a.ms);

  return { jobsRun, failures, timings, durationMs: Date.now() - startedAt };
}
