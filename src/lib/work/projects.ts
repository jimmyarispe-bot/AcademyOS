import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { WorkHealthIndicator, WorkProject, WorkProjectStatus } from "@/lib/work/types";
import { logWorkActivity, recordStatusHistory } from "@/lib/work/activity";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const today = () => new Date().toISOString().split("T")[0];

export async function createProject(
  supabase: AuthClient,
  input: {
    schoolId?: string | null;
    campusId?: string | null;
    department?: string | null;
    program?: string | null;
    name: string;
    description?: string | null;
    projectType?: string;
    priority?: string;
    ownerUserId?: string | null;
    startDate?: string | null;
    targetDate?: string | null;
    budgetAmount?: number | null;
    playbookId?: string | null;
    playbookRunId?: string | null;
    studentId?: string | null;
    employeeId?: string | null;
    familyId?: string | null;
    sourceModule?: string | null;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    createdBy?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("work_projects")
    .insert({
      school_id: input.schoolId ?? null,
      campus_id: input.campusId ?? null,
      department: input.department ?? null,
      program: input.program ?? null,
      name: input.name,
      description: input.description ?? null,
      project_type: input.projectType ?? "custom",
      priority: input.priority ?? "normal",
      owner_user_id: input.ownerUserId ?? input.createdBy ?? null,
      start_date: input.startDate ?? today(),
      target_date: input.targetDate ?? null,
      budget_amount: input.budgetAmount ?? null,
      playbook_id: input.playbookId ?? null,
      playbook_run_id: input.playbookRunId ?? null,
      student_id: input.studentId ?? null,
      employee_id: input.employeeId ?? null,
      family_id: input.familyId ?? null,
      source_module: input.sourceModule ?? null,
      source_entity_type: input.sourceEntityType ?? null,
      source_entity_id: input.sourceEntityId ?? null,
      created_by: input.createdBy ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logWorkActivity(supabase, {
    projectId: data.id,
    actorUserId: input.createdBy,
    actionType: "project_created",
    summary: `Project created: ${input.name}`,
  });

  return { id: data.id };
}

export async function updateProjectHealth(supabase: AuthClient, projectId: string) {
  const { data: tasks } = await supabase
    .from("work_tasks")
    .select("status, due_date")
    .eq("project_id", projectId)
    .not("status", "in", '("cancelled","completed")');

  const { data: project } = await supabase
    .from("work_projects")
    .select("target_date, status, budget_amount, budget_spent")
    .eq("id", projectId)
    .single();

  if (!project) return;

  const taskList = tasks ?? [];
  const total = taskList.length;
  const completed = taskList.filter((t) => t.status === "completed").length;
  const overdue = taskList.filter(
    (t) => t.due_date && t.due_date < today() && t.status !== "completed"
  ).length;
  const blocked = taskList.filter((t) => t.status === "blocked").length;

  const completionPct = total ? Math.round((completed / total) * 100) : 0;

  let health: WorkHealthIndicator = "green";
  if (blocked > 0 || overdue > 2) health = "red";
  else if (overdue > 0 || (project.target_date && project.target_date < today() && project.status !== "completed")) {
    health = "yellow";
  }

  await supabase
    .from("work_projects")
    .update({
      completion_pct: completionPct,
      health_indicator: health,
      status: completionPct === 100 && total > 0 ? "completed" : project.status,
      completed_date: completionPct === 100 && total > 0 ? today() : null,
    })
    .eq("id", projectId);
}

export async function updateProjectStatus(
  supabase: AuthClient,
  projectId: string,
  status: WorkProjectStatus,
  actorUserId?: string | null
) {
  const { data: project } = await supabase
    .from("work_projects")
    .select("status")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Not found" };

  await supabase.from("work_projects").update({ status }).eq("id", projectId);
  await recordStatusHistory(supabase, {
    entityType: "project",
    entityId: projectId,
    fromStatus: project.status,
    toStatus: status,
    changedBy: actorUserId,
  });

  await logWorkActivity(supabase, {
    projectId,
    actorUserId,
    actionType: "status_changed",
    summary: `Project status: ${project.status} → ${status}`,
    beforeState: { status: project.status },
    afterState: { status },
  });

  return { success: true };
}

export async function getProjects(
  supabase: AuthClient,
  filters?: { schoolId?: string; status?: string; projectType?: string; ownerUserId?: string; limit?: number }
) {
  let query = supabase
    .from("work_projects")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(filters?.limit ?? 100);

  if (filters?.schoolId) query = query.eq("school_id", filters.schoolId);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.projectType) query = query.eq("project_type", filters.projectType);
  if (filters?.ownerUserId) query = query.eq("owner_user_id", filters.ownerUserId);

  const { data } = await query;
  return (data ?? []) as WorkProject[];
}
