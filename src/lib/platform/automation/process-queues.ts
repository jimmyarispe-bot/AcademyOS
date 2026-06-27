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

/** Orchestrates all module queue processors — the platform job runner */
export async function processAllPlatformQueues(supabase: AuthClient) {
  await processWorkflowQueue(supabase);
  await processCommunicationQueue(supabase);
  await syncAdmissionsQueueToPlatform(supabase);
  await syncFailedAutomationsToMissionControl(supabase);
  await processSpedReviewReminders(supabase);
  await processMedicalDocumentExpiryAlerts(supabase);
  await processDisengagedFamilies(supabase);
  await processAttendanceParentNotifications(supabase);
  await processSchedulingIntelligenceQueue(supabase);
  await syncTeacherComplianceToMissionControl(supabase);
  const { syncInstructionReminderJobs, processInstructionReminders } = await import(
    "@/lib/instruction/automation"
  );
  await syncInstructionReminderJobs(supabase);
  await processInstructionReminders(supabase);
  const { syncFinanceAlertsToMissionControl, processFinanceQueueJobs } = await import(
    "@/lib/finance/automation"
  );
  await syncFinanceAlertsToMissionControl(supabase);
  await processFinanceQueueJobs(supabase);
  const { syncHrComplianceToMissionControl } = await import("@/lib/hr/automation");
  await syncHrComplianceToMissionControl(supabase);
  const { syncComplianceToMissionControl } = await import("@/lib/compliance/automation");
  await syncComplianceToMissionControl(supabase);
  const { syncWorkToMissionControl } = await import("@/lib/work/automation");
  await syncWorkToMissionControl(supabase);
  const { syncFinancialIntelligence } = await import("@/lib/financial-intelligence/automation");
  await syncFinancialIntelligence(supabase);
  const { syncExecutiveDecisionIntelligence } = await import("@/lib/edi/automation");
  await syncExecutiveDecisionIntelligence(supabase);
  const { syncEnterpriseDataPlatform } = await import("@/lib/enterprise-data/automation");
  await syncEnterpriseDataPlatform(supabase);
  const { syncIntelligencePlatform } = await import("@/lib/intelligence-platform/automation");
  await syncIntelligencePlatform(supabase);
  const { syncCloudPlatform } = await import("@/lib/cloud-platform/hub");
  await syncCloudPlatform(supabase);
  const { syncCertificationPlatform } = await import("@/lib/certification/automation");
  await syncCertificationPlatform(supabase);
  const { syncIntegrationHub } = await import("@/lib/integration-hub/automation");
  await syncIntegrationHub(supabase);
  const { syncOperationsPlatform } = await import("@/lib/operations-platform/hub");
  await syncOperationsPlatform(supabase);
  const { syncIntelligenceNetwork } = await import("@/lib/intelligence-network/automation");
  await syncIntelligenceNetwork(supabase);
  const { generateExecutiveInsights } = await import("@/lib/executive/insights");
  const { data: schools } = await supabase.from("schools").select("id").limit(20);
  for (const school of schools ?? []) {
    await generateExecutiveInsights(supabase, school.id);
  }
  if (!schools?.length) {
    await generateExecutiveInsights(supabase);
  }
}
