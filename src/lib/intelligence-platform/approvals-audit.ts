import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { AipApprovalType } from "@/lib/intelligence-platform/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function requestApproval(
  supabase: AuthClient,
  input: {
    organizationId: string;
    entityType: string;
    entityId: string;
    approvalType: AipApprovalType;
    requestedBy?: string;
  }
) {
  const status = input.approvalType === "auto_approved" ? "approved" : "pending";
  const { data, error } = await supabase
    .from("aip_approvals")
    .insert({
      organization_id: input.organizationId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      approval_type: input.approvalType,
      status,
      requested_by: input.requestedBy ?? null,
      reviewed_at: status === "approved" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { approvalId: data.id, status };
}

export async function reviewApproval(
  supabase: AuthClient,
  approvalId: string,
  input: { status: "approved" | "rejected" | "published"; reviewedBy?: string; notes?: string }
) {
  await supabase.from("aip_approvals").update({
    status: input.status,
    reviewed_by: input.reviewedBy ?? null,
    review_notes: input.notes ?? null,
    reviewed_at: new Date().toISOString(),
  }).eq("id", approvalId);
}

export async function getPendingApprovals(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("aip_approvals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .order("requested_at", { ascending: false });
  return data ?? [];
}

export async function getAuditLogs(supabase: AuthClient, organizationId: string, limit = 50) {
  const { data } = await supabase
    .from("aip_audit_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function logAuditEvent(
  supabase: AuthClient,
  input: {
    organizationId: string;
    schoolId?: string;
    requestedBy?: string;
    promptId?: string;
    promptVersionId?: string;
    jobId?: string;
    providerKey?: string;
    contextSources?: unknown[];
    responseStatus?: string;
    approvalStatus?: string;
    executionTimeMs?: number;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("aip_audit_logs").insert({
    organization_id: input.organizationId,
    school_id: input.schoolId ?? null,
    requested_by: input.requestedBy ?? null,
    prompt_id: input.promptId ?? null,
    prompt_version_id: input.promptVersionId ?? null,
    job_id: input.jobId ?? null,
    provider_key: input.providerKey ?? null,
    context_sources: input.contextSources ?? [],
    response_status: input.responseStatus ?? "simulated",
    approval_status: input.approvalStatus ?? null,
    execution_time_ms: input.executionTimeMs ?? null,
    metadata: input.metadata ?? {},
  });
}
