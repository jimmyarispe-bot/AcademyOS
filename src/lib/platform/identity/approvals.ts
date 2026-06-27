import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ApprovalRule } from "@/lib/platform/identity/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getApprovalRules(supabase: AuthClient, schoolId?: string) {
  let query = supabase
    .from("platform_approval_rules")
    .select("*")
    .eq("is_active", true)
    .order("priority");

  if (schoolId) {
    query = query.or(`school_id.is.null,school_id.eq.${schoolId}`);
  } else {
    query = query.is("school_id", null);
  }

  const { data } = await query;
  return (data ?? []) as ApprovalRule[];
}

export async function getPendingApprovals(supabase: AuthClient, limit = 50) {
  const { data } = await supabase
    .from("platform_approval_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function submitApprovalRequest(
  supabase: AuthClient,
  input: {
    ruleId?: string | null;
    schoolId?: string | null;
    module: string;
    entityType: string;
    entityId: string;
    title: string;
    summary?: string;
    requestedBy: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { data, error } = await supabase
    .from("platform_approval_requests")
    .insert({
      rule_id: input.ruleId ?? null,
      school_id: input.schoolId ?? null,
      module: input.module,
      entity_type: input.entityType,
      entity_id: input.entityId,
      title: input.title,
      summary: input.summary ?? "",
      requested_by: input.requestedBy,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("platform_security_events").insert({
    event_type: "approval_submitted",
    actor_user_id: input.requestedBy,
    school_id: input.schoolId ?? null,
    summary: `Approval submitted: ${input.title}`,
    metadata: { requestId: data.id, entityType: input.entityType },
  });

  return { success: true, requestId: data.id };
}

export async function decideApprovalRequest(
  supabase: AuthClient,
  input: {
    requestId: string;
    status: "approved" | "rejected";
    decidedBy: string;
    decisionNotes?: string;
  }
) {
  const { error } = await supabase
    .from("platform_approval_requests")
    .update({
      status: input.status,
      decided_by: input.decidedBy,
      decided_at: new Date().toISOString(),
      decision_notes: input.decisionNotes ?? null,
    })
    .eq("id", input.requestId);

  if (error) return { error: error.message };

  await supabase.from("platform_security_events").insert({
    event_type: "approval_decided",
    actor_user_id: input.decidedBy,
    summary: `Approval ${input.status}`,
    metadata: { requestId: input.requestId },
  });

  return { success: true };
}

/** Evaluate whether an action requires approval based on configured rules */
export async function evaluateApprovalRequired(
  supabase: AuthClient,
  input: { module: string; field: string; value: number; schoolId?: string | null }
): Promise<ApprovalRule | null> {
  const rules = await getApprovalRules(supabase, input.schoolId ?? undefined);

  for (const rule of rules) {
    if (rule.module !== input.module) continue;
    const config = rule as ApprovalRule & { condition_config?: { field?: string; operator?: string } };
    const cond = config.condition_config;
    if (cond?.field !== input.field) continue;

    if (rule.threshold_value != null && input.value > rule.threshold_value) {
      return rule;
    }
  }

  return null;
}
