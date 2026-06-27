import type { createAuthClient } from "@/lib/supabase/server-auth";
import type {
  MissionControlItemType,
  PlatformModule,
} from "@/lib/platform/automation/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface CreateMissionControlItemInput {
  schoolId?: string | null;
  module: PlatformModule;
  itemType: MissionControlItemType;
  title: string;
  body?: string;
  severity?: "low" | "normal" | "high" | "critical";
  entityType?: string | null;
  entityId?: string | null;
  assignedRole?: string | null;
  assignedUserId?: string | null;
  href?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createMissionControlItem(
  supabase: AuthClient,
  input: CreateMissionControlItemInput
) {
  await supabase.from("platform_mission_control_items").insert({
    school_id: input.schoolId ?? null,
    module: input.module,
    item_type: input.itemType,
    severity: input.severity ?? "normal",
    title: input.title,
    body: input.body ?? "",
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    assigned_role: input.assignedRole ?? null,
    assigned_user_id: input.assignedUserId ?? null,
    href: input.href ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function resolveMissionControlItem(supabase: AuthClient, itemId: string) {
  await supabase
    .from("platform_mission_control_items")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", itemId);
}

export async function getMissionControlFeed(
  supabase: AuthClient,
  filters?: {
    schoolId?: string;
    assignedRole?: string;
    assignedUserId?: string;
    module?: PlatformModule;
    allowedModules?: string[];
    accessibleSchoolIds?: string[];
    limit?: number;
  }
) {
  let query = supabase
    .from("platform_mission_control_items")
    .select("*")
    .eq("is_resolved", false)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 50);

  if (filters?.schoolId) query = query.eq("school_id", filters.schoolId);
  if (filters?.accessibleSchoolIds?.length) {
    query = query.or(
      `school_id.is.null,school_id.in.(${filters.accessibleSchoolIds.join(",")})`
    );
  }
  if (filters?.module) query = query.eq("module", filters.module);
  if (filters?.allowedModules?.length) query = query.in("module", filters.allowedModules);

  if (filters?.assignedUserId) {
    query = query.or(
      `assigned_user_id.eq.${filters.assignedUserId},assigned_role.eq.${filters.assignedRole ?? "none"},assigned_role.is.null`
    );
  } else if (filters?.assignedRole) {
    query = query.or(`assigned_role.eq.${filters.assignedRole},assigned_role.is.null`);
  }

  const { data } = await query;
  return data ?? [];
}

export async function syncFailedAutomationsToMissionControl(supabase: AuthClient) {
  const { data: failed } = await supabase
    .from("admissions_workflow_executions")
    .select("id, lead_id, trigger_event, error_message, admissions_workflows(name)")
    .eq("status", "failed")
    .gte("started_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .limit(20);

  for (const exec of failed ?? []) {
    const { data: lead } = await supabase
      .from("admissions_leads")
      .select("school_id, first_name, last_name")
      .eq("id", exec.lead_id)
      .single();

    if (!lead?.school_id) continue;

    await createMissionControlItem(supabase, {
      schoolId: lead.school_id,
      module: "admissions",
      itemType: "failed_automation",
      severity: "high",
      title: `Failed automation: ${(exec.admissions_workflows as { name?: string } | null)?.name ?? exec.trigger_event}`,
      body: exec.error_message ?? "Workflow execution failed",
      entityType: "admissions_lead",
      entityId: exec.lead_id,
      assignedRole: "SCHOOL_LEADER",
      href: `/dashboard/admissions/leads/${exec.lead_id}`,
      metadata: { execution_id: exec.id },
    });
  }
}
