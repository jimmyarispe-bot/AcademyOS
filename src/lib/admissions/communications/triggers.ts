import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { MergeContext } from "@/lib/admissions/communications/merge-fields";
import {
  processCommunicationQueue,
  scheduleApplicationIncompleteReminders,
  scheduleTourReminders,
  triggerCommunications,
} from "@/lib/admissions/communications/engine";
import type { CommunicationTriggerEvent } from "@/lib/admissions/communications/types";
import { dispatchAdmissionsAutomation } from "@/lib/admissions/automation/dispatch";
import type { WorkflowTriggerEvent } from "@/lib/admissions/automation/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface NotifyAdmissionsEventOptions {
  leadId: string;
  applicationId?: string | null;
  events: CommunicationTriggerEvent[];
  mergeOverrides?: Partial<MergeContext>;
  sentBy?: string | null;
  tourScheduledAt?: string;
  interviewScheduledAt?: string;
  processQueue?: boolean;
}

/** Low-level comm trigger — prefer dispatch helpers below for new code */
export async function notifyAdmissionsEvent(
  supabase: AuthClient,
  options: NotifyAdmissionsEventOptions
) {
  for (const triggerEvent of options.events) {
    await triggerCommunications(supabase, {
      leadId: options.leadId,
      applicationId: options.applicationId,
      triggerEvent,
      mergeOverrides: options.mergeOverrides,
      sentBy: options.sentBy ?? null,
    });
  }

  if (options.tourScheduledAt) {
    await scheduleTourReminders(supabase, options.leadId, options.tourScheduledAt);
  }

  if (options.interviewScheduledAt) {
    await scheduleInterviewReminders(
      supabase,
      options.leadId,
      options.applicationId ?? null,
      options.interviewScheduledAt
    );
  }

  if (options.processQueue !== false) {
    await processCommunicationQueue(supabase);
  }
}

export async function scheduleInterviewReminders(
  supabase: AuthClient,
  leadId: string,
  applicationId: string | null,
  interviewScheduledAt: string
) {
  const interviewDate = new Date(interviewScheduledAt);
  const reminders: { event: CommunicationTriggerEvent; hoursBefore: number }[] = [
    { event: "interview_reminder_24h", hoursBefore: 24 },
    { event: "interview_reminder_2h", hoursBefore: 2 },
  ];

  const { data: lead } = await supabase
    .from("admissions_leads")
    .select("school_id")
    .eq("id", leadId)
    .single();

  if (!lead?.school_id) return;

  for (const { event, hoursBefore } of reminders) {
    const { data: templates } = await supabase
      .from("admissions_communication_templates")
      .select("*")
      .eq("trigger_event", event)
      .eq("is_active", true)
      .or(`school_id.is.null,school_id.eq.${lead.school_id}`);

    for (const template of templates ?? []) {
      const scheduledFor = new Date(
        interviewDate.getTime() - hoursBefore * 60 * 60 * 1000
      ).toISOString();

      if (new Date(scheduledFor) <= new Date()) continue;

      await supabase.from("admissions_communication_queue").insert({
        lead_id: leadId,
        application_id: applicationId,
        template_id: template.id,
        template_key: template.template_key,
        trigger_event: event,
        channel: template.channel,
        scheduled_for: scheduledFor,
        status: "pending",
      });
    }
  }
}

async function dispatch(
  supabase: AuthClient,
  trigger: WorkflowTriggerEvent,
  opts: {
    leadId: string;
    applicationId?: string | null;
    sentBy?: string | null;
    mergeOverrides?: Partial<MergeContext>;
    tourScheduledAt?: string;
    interviewScheduledAt?: string;
  }
) {
  await dispatchAdmissionsAutomation(supabase, {
    trigger,
    leadId: opts.leadId,
    applicationId: opts.applicationId,
    sentBy: opts.sentBy,
    mergeOverrides: opts.mergeOverrides as Record<string, unknown>,
    tourScheduledAt: opts.tourScheduledAt,
    interviewScheduledAt: opts.interviewScheduledAt,
  });
}

export async function notifyMissingDocumentsIfNeeded(
  supabase: AuthClient,
  leadId: string,
  applicationId: string,
  sentBy?: string | null
) {
  const { data: pending } = await supabase
    .from("admissions_application_checklist_items")
    .select("item_key")
    .eq("application_id", applicationId)
    .eq("status", "pending");

  if (!pending?.length) return;

  const labels = pending.map((p) => p.item_key.replace(/_/g, " "));

  await dispatch(supabase, "missing_documents", {
    leadId,
    applicationId,
    sentBy,
    mergeOverrides: { missingDocuments: labels, missingItems: labels },
  });
}

export async function notifyStateFundingNeeded(
  supabase: AuthClient,
  leadId: string,
  applicationId: string,
  sentBy?: string | null
) {
  const { data: verifications } = await supabase
    .from("state_funding_verifications")
    .select("id")
    .eq("application_id", applicationId)
    .in("verification_status", ["pending", "rejected"]);

  if (!verifications?.length) return;

  await triggerCommunications(supabase, {
    leadId,
    applicationId,
    triggerEvent: "state_funding_verification_needed",
    sentBy: sentBy ?? null,
  });
}

export async function onApplicationStarted(
  supabase: AuthClient,
  leadId: string,
  applicationId: string,
  sentBy?: string | null
) {
  await dispatch(supabase, "application_started", {
    leadId,
    applicationId,
    sentBy,
  });
}

export async function onInquirySubmitted(
  supabase: AuthClient,
  leadId: string,
  sentBy?: string | null
) {
  await dispatch(supabase, "inquiry_submitted", { leadId, sentBy });
}

export async function onTourScheduled(
  supabase: AuthClient,
  leadId: string,
  scheduledAt: string,
  sentBy?: string | null
) {
  await dispatch(supabase, "tour_scheduled", {
    leadId,
    sentBy,
    tourScheduledAt: scheduledAt,
    mergeOverrides: { tourDatetime: new Date(scheduledAt).toLocaleString() },
  });
}

export async function onApplicationSubmitted(
  supabase: AuthClient,
  leadId: string,
  applicationId: string,
  sentBy?: string | null
) {
  await dispatch(supabase, "application_submitted", {
    leadId,
    applicationId,
    sentBy,
  });
}

export async function onFundingVerificationDecision(
  supabase: AuthClient,
  leadId: string,
  applicationId: string,
  status: string,
  rejectionReason: string | null,
  sentBy?: string | null
) {
  await dispatch(
    supabase,
    status === "verified" ? "funding_verified" : "funding_rejected",
    {
      leadId,
      applicationId,
      sentBy,
      mergeOverrides: { rejectionReason },
    }
  );
}

export async function onDecisionSubmitted(
  supabase: AuthClient,
  leadId: string,
  applicationId: string | null,
  decisionType: "accept" | "waitlist" | "deny" | "request_info",
  customNotes: string,
  sentBy?: string | null
) {
  const triggerMap: Record<typeof decisionType, WorkflowTriggerEvent> = {
    accept: "accepted",
    waitlist: "waitlisted",
    deny: "declined",
    request_info: "admissions_decision",
  };

  await dispatch(supabase, triggerMap[decisionType], {
    leadId,
    applicationId,
    sentBy,
    mergeOverrides: { customNotes },
  });
}

export async function onEnrollmentCompleted(
  supabase: AuthClient,
  leadId: string,
  applicationId: string | null,
  sentBy?: string | null
) {
  await dispatch(supabase, "enrollment_completed", {
    leadId,
    applicationId,
    sentBy,
  });
}

export async function onInterviewScheduled(
  supabase: AuthClient,
  leadId: string,
  applicationId: string | null,
  scheduledAt: string,
  sentBy?: string | null
) {
  await dispatch(supabase, "interview_scheduled", {
    leadId,
    applicationId,
    sentBy,
    interviewScheduledAt: scheduledAt,
    mergeOverrides: { interviewDatetime: new Date(scheduledAt).toLocaleString() },
  });
}

export async function onDocumentUploaded(
  supabase: AuthClient,
  leadId: string,
  applicationId: string,
  sentBy?: string | null
) {
  await dispatch(supabase, "documents_uploaded", {
    leadId,
    applicationId,
    sentBy,
  });
}

export async function onFinancialAidSubmitted(
  supabase: AuthClient,
  leadId: string,
  applicationId: string,
  sentBy?: string | null
) {
  await dispatch(supabase, "financial_aid_submitted", {
    leadId,
    applicationId,
    sentBy,
  });
}

export async function onApplicationSaved(
  supabase: AuthClient,
  leadId: string,
  applicationId: string,
  sentBy?: string | null
) {
  await dispatch(supabase, "application_saved", {
    leadId,
    applicationId,
    sentBy,
  });
}
