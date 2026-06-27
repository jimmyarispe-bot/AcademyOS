import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { PlatformModule } from "@/lib/platform/automation/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface WritePlatformAuditInput {
  schoolId?: string | null;
  module: PlatformModule;
  entityType: string;
  entityId: string;
  actionType: string;
  summary: string;
  workflowId?: string | null;
  workflowKey?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  ipAddress?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  isSystemEvent?: boolean;
}

export async function writePlatformAudit(
  supabase: AuthClient,
  input: WritePlatformAuditInput
) {
  await supabase.from("platform_audit_events").insert({
    school_id: input.schoolId ?? null,
    module: input.module,
    entity_type: input.entityType,
    entity_id: input.entityId,
    workflow_id: input.workflowId ?? null,
    workflow_key: input.workflowKey ?? null,
    action_type: input.actionType,
    actor_user_id: input.actorUserId ?? null,
    actor_role: input.actorRole ?? null,
    ip_address: input.ipAddress ?? null,
    summary: input.summary,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    metadata: input.metadata ?? {},
    is_system_event: input.isSystemEvent ?? false,
  });
}

export async function searchPlatformAudit(
  supabase: AuthClient,
  filters: {
    module?: PlatformModule;
    entityType?: string;
    entityId?: string;
    schoolId?: string;
    query?: string;
    limit?: number;
  }
) {
  let q = supabase
    .from("platform_audit_events")
    .select("*, users(full_name)")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 50);

  if (filters.module) q = q.eq("module", filters.module);
  if (filters.entityType) q = q.eq("entity_type", filters.entityType);
  if (filters.entityId) q = q.eq("entity_id", filters.entityId);
  if (filters.schoolId) q = q.eq("school_id", filters.schoolId);

  const { data } = await q;
  let results = data ?? [];

  if (filters.query) {
    const needle = filters.query.toLowerCase();
    results = results.filter(
      (r) =>
        r.summary.toLowerCase().includes(needle) ||
        JSON.stringify(r.metadata).toLowerCase().includes(needle)
    );
  }

  return results;
}
