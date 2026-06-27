import type { createAuthClient } from "@/lib/supabase/server-auth";
import { writePlatformAudit } from "@/lib/platform/automation/audit";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface WriteAuditLogInput {
  schoolId?: string | null;
  leadId?: string | null;
  applicationId?: string | null;
  executionId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  eventCategory?: string;
  summary: string;
  details?: Record<string, unknown>;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}

export async function writeAuditLog(
  supabase: AuthClient,
  input: WriteAuditLogInput
) {
  await supabase.from("admissions_automation_audit_log").insert({
    school_id: input.schoolId ?? null,
    lead_id: input.leadId ?? null,
    application_id: input.applicationId ?? null,
    execution_id: input.executionId ?? null,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    event_category: input.eventCategory ?? "automation",
    summary: input.summary,
    details: input.details ?? {},
    module: "admissions",
    entity_type: input.leadId ? "admissions_lead" : null,
    entity_id: input.leadId ?? null,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
  });

  if (input.leadId && input.schoolId) {
    await writePlatformAudit(supabase, {
      schoolId: input.schoolId,
      module: "admissions",
      entityType: "admissions_lead",
      entityId: input.leadId,
      actionType: input.eventType,
      summary: input.summary,
      actorUserId: input.actorUserId ?? null,
      beforeState: input.beforeState,
      afterState: input.afterState,
      metadata: input.details,
      isSystemEvent: !input.actorUserId,
    });
  }
}
