import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { WorkExecutiveMetrics } from "@/lib/work/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const today = () => new Date().toISOString().split("T")[0];

export async function getWorkExecutiveMetrics(
  supabase: AuthClient,
  schoolId?: string
): Promise<WorkExecutiveMetrics> {
  let projectQuery = supabase
    .from("work_projects")
    .select("school_id, department, status, health_indicator, completion_pct, target_date")
    .not("status", "in", '("archived","cancelled")');

  if (schoolId) projectQuery = projectQuery.eq("school_id", schoolId);

  let taskQuery = supabase
    .from("work_tasks")
    .select("status, due_date, estimated_hours, actual_hours, school_id")
    .not("status", "in", '("cancelled","completed")');

  if (schoolId) taskQuery = taskQuery.eq("school_id", schoolId);

  const [{ data: projects }, { data: tasks }, { count: playbookRuns }] = await Promise.all([
    projectQuery,
    taskQuery,
    supabase
      .from("work_playbook_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
  ]);

  const { count: milestoneCount } = await supabase
    .from("work_milestones")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .gte("due_date", today())
    .lte("due_date", new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);

  const projectsBySchool: Record<string, number> = {};
  const projectsByDepartment: Record<string, number> = {};
  const healthBreakdown = { green: 0, yellow: 0, red: 0 };
  let delayedProjects = 0;
  let completionSum = 0;

  for (const p of projects ?? []) {
    const schoolKey = p.school_id ?? "network";
    projectsBySchool[schoolKey] = (projectsBySchool[schoolKey] ?? 0) + 1;
    const dept = p.department ?? "general";
    projectsByDepartment[dept] = (projectsByDepartment[dept] ?? 0) + 1;
    const health = p.health_indicator as "green" | "yellow" | "red";
    healthBreakdown[health] = (healthBreakdown[health] ?? 0) + 1;
    completionSum += Number(p.completion_pct ?? 0);
    if (p.target_date && p.target_date < today() && p.status !== "completed") delayedProjects++;
  }

  const t = today();
  let overdueTasks = 0;
  let blockedTasks = 0;
  let totalEstimatedHours = 0;
  let totalActualHours = 0;

  for (const task of tasks ?? []) {
    if (task.due_date && task.due_date < t) overdueTasks++;
    if (task.status === "blocked") blockedTasks++;
    totalEstimatedHours += Number(task.estimated_hours ?? 0);
    totalActualHours += Number(task.actual_hours ?? 0);
  }

  return {
    projectsBySchool,
    projectsByDepartment,
    completionRate: projects?.length ? Math.round(completionSum / projects.length) : 100,
    delayedProjects,
    overdueTasks,
    blockedTasks,
    totalEstimatedHours,
    totalActualHours,
    upcomingMilestones: milestoneCount ?? 0,
    playbookRunsCompleted: playbookRuns ?? 0,
    healthBreakdown,
  };
}
