import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function logWorkActivity(
  supabase: AuthClient,
  input: {
    projectId?: string | null;
    taskId?: string | null;
    actorUserId?: string | null;
    actionType: string;
    summary: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("work_activity_log").insert({
    project_id: input.projectId ?? null,
    task_id: input.taskId ?? null,
    actor_user_id: input.actorUserId ?? null,
    action_type: input.actionType,
    summary: input.summary,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function recordStatusHistory(
  supabase: AuthClient,
  input: {
    entityType: "project" | "task" | "milestone";
    entityId: string;
    fromStatus?: string | null;
    toStatus: string;
    changedBy?: string | null;
    reason?: string | null;
  }
) {
  await supabase.from("work_status_history").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus,
    changed_by: input.changedBy ?? null,
    reason: input.reason ?? null,
  });
}
