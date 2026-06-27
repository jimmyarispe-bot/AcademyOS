import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function logComplianceAudit(
  supabase: AuthClient,
  input: {
    obligationId: string;
    schoolId?: string | null;
    actionType: string;
    summary: string;
    actorUserId?: string | null;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
  }
) {
  await supabase.from("compliance_audit_log").insert({
    obligation_id: input.obligationId,
    school_id: input.schoolId ?? null,
    action_type: input.actionType,
    actor_user_id: input.actorUserId ?? null,
    summary: input.summary,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
  });
}
