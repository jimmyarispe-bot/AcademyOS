import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { updateProjectHealth } from "@/lib/work/projects";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const today = () => new Date().toISOString().split("T")[0];

export async function syncWorkToMissionControl(supabase: AuthClient) {
  await markOverdueTasks(supabase);
  await syncBlockedProjects(supabase);
  await syncCriticalTasks(supabase);
  await syncWaitingApprovals(supabase);
  await refreshAllProjectHealth(supabase);
}

async function markOverdueTasks(supabase: AuthClient) {
  // Overdue tasks are surfaced via Mission Control — status remains unchanged for user workflow
  void supabase;
}

async function syncBlockedProjects(supabase: AuthClient) {
  const { data: projects } = await supabase
    .from("work_projects")
    .select("id, name, school_id, health_indicator")
    .eq("health_indicator", "red")
    .in("status", ["active", "blocked", "planning"]);

  for (const p of projects ?? []) {
    const { data: existing } = await supabase
      .from("platform_mission_control_items")
      .select("id")
      .eq("entity_type", "work_projects")
      .eq("entity_id", p.id)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existing) continue;

    await createMissionControlItem(supabase, {
      schoolId: p.school_id,
      module: "compliance",
      itemType: "compliance_alert",
      title: `Blocked project: ${p.name}`,
      body: "Project health is red — review overdue or blocked tasks",
      href: `/dashboard/projects?id=${p.id}`,
      entityType: "work_projects",
      entityId: p.id,
      assignedRole: "SCHOOL_LEADER",
      severity: "high",
    });
  }
}

async function syncCriticalTasks(supabase: AuthClient) {
  const t = today();
  const { data: tasks } = await supabase
    .from("work_tasks")
    .select("id, title, school_id, owner_user_id, due_date, priority")
    .in("priority", ["critical", "high"])
    .not("status", "in", '("completed","cancelled")')
    .or(`due_date.lt.${t},priority.eq.critical`);

  for (const task of tasks ?? []) {
    const { data: existing } = await supabase
      .from("platform_mission_control_items")
      .select("id")
      .eq("entity_type", "work_tasks")
      .eq("entity_id", task.id)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existing) continue;

    await createMissionControlItem(supabase, {
      schoolId: task.school_id,
      module: "compliance",
      itemType: "compliance_alert",
      title: task.due_date && task.due_date < t ? `Overdue: ${task.title}` : `Critical: ${task.title}`,
      href: `/dashboard/tasks?id=${task.id}`,
      entityType: "work_tasks",
      entityId: task.id,
      assignedUserId: task.owner_user_id,
      severity: task.priority === "critical" ? "critical" : "high",
    });
  }
}

async function syncWaitingApprovals(supabase: AuthClient) {
  const { data: tasks } = await supabase
    .from("work_tasks")
    .select("id, title, school_id, owner_user_id")
    .eq("status", "needs_review")
    .eq("task_type", "approval");

  for (const task of tasks ?? []) {
    await createMissionControlItem(supabase, {
      schoolId: task.school_id,
      module: "executive",
      itemType: "executive_alert",
      title: `Approval waiting: ${task.title}`,
      href: `/dashboard/work?view=approvals`,
      entityType: "work_tasks",
      entityId: task.id,
      assignedUserId: task.owner_user_id,
      severity: "normal",
    });
  }
}

async function refreshAllProjectHealth(supabase: AuthClient) {
  const { data: projects } = await supabase
    .from("work_projects")
    .select("id")
    .in("status", ["active", "planning", "blocked"]);

  for (const p of projects ?? []) {
    await updateProjectHealth(supabase, p.id);
  }
}
