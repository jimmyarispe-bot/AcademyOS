import type { createAuthClient } from "@/lib/supabase/server-auth";
import { runWorkflowEngine } from "@/lib/admissions/automation/engine";
import { processWorkflowQueue } from "@/lib/admissions/automation/queue";
import { scheduleEscalationsForTrigger } from "@/lib/admissions/automation/escalations";
import { recordAdmissionsPlatformEvent } from "@/lib/admissions/automation/platform-adapter";
import { notifyAdmissionsEvent } from "@/lib/admissions/communications/triggers";
import { processAllPlatformQueues } from "@/lib/platform/automation/process-queues";
import type { CommunicationTriggerEvent } from "@/lib/admissions/communications/types";
import type { DispatchAutomationOptions, WorkflowTriggerEvent } from "@/lib/admissions/automation/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/** Maps workflow triggers to legacy communication events for fallback */
const LEGACY_EVENT_MAP: Partial<Record<WorkflowTriggerEvent, CommunicationTriggerEvent[]>> = {
  inquiry_submitted: ["inquiry_submitted", "staff_new_inquiry"],
  tour_scheduled: ["tour_scheduled"],
  application_started: ["application_started", "staff_application_started"],
  application_submitted: ["application_submitted", "staff_application_submitted"],
  documents_uploaded: ["staff_documents_uploaded"],
  funding_verified: ["funding_verification_approved", "staff_funding_verified"],
  funding_rejected: ["funding_verification_rejected"],
  financial_aid_submitted: ["financial_aid_documents_requested", "staff_financial_aid_submitted"],
  interview_scheduled: ["interview_scheduled", "staff_interview_scheduled"],
  accepted: ["student_accepted", "staff_application_accepted"],
  waitlisted: ["student_waitlisted"],
  declined: ["student_declined"],
  enrollment_completed: ["enrollment_completed"],
  missing_documents: ["missing_documents"],
  admissions_decision: ["additional_info_requested"],
};

export async function dispatchAdmissionsAutomation(
  supabase: AuthClient,
  options: DispatchAutomationOptions
) {
  const ranWorkflows = await runWorkflowEngine(supabase, options);

  if (!ranWorkflows && !options.skipLegacyFallback) {
    const legacyEvents = LEGACY_EVENT_MAP[options.trigger];
    if (legacyEvents?.length) {
      await notifyAdmissionsEvent(supabase, {
        leadId: options.leadId,
        applicationId: options.applicationId,
        events: legacyEvents,
        mergeOverrides: options.mergeOverrides as Parameters<
          typeof notifyAdmissionsEvent
        >[1]["mergeOverrides"],
        sentBy: options.sentBy,
        tourScheduledAt: options.tourScheduledAt,
        interviewScheduledAt: options.interviewScheduledAt,
      });
    }
  }

  const { data: lead } = await supabase
    .from("admissions_leads")
    .select("school_id")
    .eq("id", options.leadId)
    .single();

  if (lead?.school_id) {
    await scheduleEscalationsForTrigger(
      supabase,
      lead.school_id,
      options.trigger,
      options.leadId,
      options.applicationId ?? null
    );

    await recordAdmissionsPlatformEvent(supabase, {
      trigger: options.trigger,
      leadId: options.leadId,
      applicationId: options.applicationId,
      schoolId: lead.school_id,
      sentBy: options.sentBy,
    });
  }

  await processAllPlatformQueues(supabase);
}
