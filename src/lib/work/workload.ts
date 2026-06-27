import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { WorkloadBucket, WorkProject, WorkTask, MyWorkSummary } from "@/lib/work/types";
import { getProjects } from "@/lib/work/projects";
import { getTasks } from "@/lib/work/tasks";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const today = () => new Date().toISOString().split("T")[0];
const weekEnd = () => new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

function bucketTasks(tasks: WorkTask[]): Pick<WorkloadBucket, "today" | "thisWeek" | "upcoming" | "overdue" | "waiting" | "approvals"> {
  const t = today();
  const we = weekEnd();
  const active = tasks.filter((task) => !["completed", "cancelled"].includes(task.status));

  return {
    today: active.filter((task) => task.due_date === t),
    thisWeek: active.filter((task) => task.due_date && task.due_date > t && task.due_date <= we),
    upcoming: active.filter((task) => task.due_date && task.due_date > we),
    overdue: active.filter((task) => task.due_date && task.due_date < t),
    waiting: active.filter((task) => ["waiting", "blocked", "needs_review"].includes(task.status)),
    approvals: active.filter((task) => task.status === "needs_review" || task.task_type === "approval"),
  };
}

export async function getUserWorkload(
  supabase: AuthClient,
  userId: string,
  schoolId?: string
): Promise<WorkloadBucket> {
  const tasks = await getTasks(supabase, {
    assigneeUserId: userId,
    schoolId,
    limit: 300,
  });

  const ownedTasks = await getTasks(supabase, { ownerUserId: userId, schoolId, limit: 300 });
  const merged = [...tasks];
  for (const t of ownedTasks) {
    if (!merged.some((m) => m.id === t.id)) merged.push(t);
  }

  const bucket = bucketTasks(merged);
  const projects = await getProjects(supabase, {
    ownerUserId: userId,
    schoolId,
    limit: 50,
  });

  return { ...bucket, projects };
}

export async function getMyWorkSummary(
  supabase: AuthClient,
  userId: string,
  schoolId?: string
): Promise<MyWorkSummary> {
  const workload = await getUserWorkload(supabase, userId, schoolId);

  const { count: mcCount } = await supabase
    .from("platform_mission_control_items")
    .select("id", { count: "exact", head: true })
    .eq("is_resolved", false)
    .eq("assigned_user_id", userId);

  return {
    tasksToday: workload.today.length,
    tasksThisWeek: workload.thisWeek.length,
    overdue: workload.overdue.length,
    waitingApprovals: workload.approvals.length,
    activeProjects: workload.projects.filter((p) => p.status === "active").length,
    missionControlAlerts: mcCount ?? 0,
  };
}

export async function getDepartmentWorkload(
  supabase: AuthClient,
  department: string,
  schoolId?: string
) {
  let query = supabase
    .from("work_tasks")
    .select("owner_user_id, status, estimated_hours, actual_hours, due_date")
    .eq("department", department)
    .not("status", "in", '("completed","cancelled")');

  if (schoolId) query = query.eq("school_id", schoolId);

  const { data } = await query;
  const byUser: Record<string, { count: number; hours: number; overdue: number }> = {};
  const t = today();

  for (const row of data ?? []) {
    const uid = row.owner_user_id ?? "unassigned";
    if (!byUser[uid]) byUser[uid] = { count: 0, hours: 0, overdue: 0 };
    byUser[uid].count++;
    byUser[uid].hours += Number(row.estimated_hours ?? 0);
    if (row.due_date && row.due_date < t) byUser[uid].overdue++;
  }

  return byUser;
}
