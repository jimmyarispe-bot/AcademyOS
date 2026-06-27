import type { createAuthClient } from "@/lib/supabase/server-auth";
import { writePlatformAudit } from "@/lib/platform/automation/audit";
import { writeTimelineEvent } from "@/lib/platform/automation/timeline";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import type { WorkflowTriggerEvent } from "@/lib/admissions/automation/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const TRIGGER_LABELS: Partial<Record<WorkflowTriggerEvent, string>> = {
  inquiry_submitted: "Inquiry submitted",
  tour_scheduled: "Tour scheduled",
  application_started: "Application started",
  application_submitted: "Application submitted",
  documents_uploaded: "Documents uploaded",
  funding_verified: "Funding verified",
  funding_rejected: "Funding rejected",
  interview_scheduled: "Interview scheduled",
  accepted: "Student accepted",
  waitlisted: "Student waitlisted",
  declined: "Student declined",
  enrollment_completed: "Enrollment completed",
};

export interface AdmissionsPlatformEventInput {
  trigger: WorkflowTriggerEvent;
  leadId: string;
  applicationId?: string | null;
  schoolId: string;
  sentBy?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/** Dual-write admissions automation events to platform timeline + audit */
export async function recordAdmissionsPlatformEvent(
  supabase: AuthClient,
  input: AdmissionsPlatformEventInput
) {
  const summary =
    input.summary ??
    TRIGGER_LABELS[input.trigger] ??
    `Admissions automation: ${input.trigger}`;

  await Promise.all([
    writePlatformAudit(supabase, {
      schoolId: input.schoolId,
      module: "admissions",
      entityType: "admissions_lead",
      entityId: input.leadId,
      actionType: input.trigger,
      summary,
      actorUserId: input.sentBy ?? null,
      metadata: {
        application_id: input.applicationId,
        ...input.metadata,
      },
      isSystemEvent: !input.sentBy,
    }),
    writeTimelineEvent(supabase, {
      schoolId: input.schoolId,
      module: "admissions",
      entityType: "admissions_lead",
      entityId: input.leadId,
      eventType: "workflow",
      title: summary,
      body: input.applicationId ? `Application ${input.applicationId}` : "",
      actorUserId: input.sentBy ?? null,
      relatedEntityType: input.applicationId ? "admissions_application" : null,
      relatedEntityId: input.applicationId ?? null,
      metadata: input.metadata,
    }),
  ]);

  if (input.trigger === "funding_rejected" || input.trigger === "missing_documents") {
    await createMissionControlItem(supabase, {
      schoolId: input.schoolId,
      module: "admissions",
      itemType: input.trigger === "funding_rejected" ? "funding_alert" : "admissions_alert",
      severity: "normal",
      title: summary,
      entityType: "admissions_lead",
      entityId: input.leadId,
      assignedRole: "SCHOOL_LEADER",
      href: `/dashboard/admissions/leads/${input.leadId}`,
    });
  }
}

export async function recordExecutiveFlag(
  supabase: AuthClient,
  schoolId: string,
  leadId: string,
  summary: string
) {
  await createMissionControlItem(supabase, {
    schoolId,
    module: "executive",
    itemType: "executive_alert",
    severity: "high",
    title: summary,
    entityType: "admissions_lead",
    entityId: leadId,
    assignedRole: "CEO",
    href: `/dashboard/admissions/leads/${leadId}`,
  });
}
