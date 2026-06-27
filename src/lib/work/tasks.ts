import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { WorkTask, WorkTaskStatus } from "@/lib/work/types";
import { logWorkActivity, recordStatusHistory } from "@/lib/work/activity";
import { updateProjectHealth } from "@/lib/work/projects";
import { registerComplianceObligation } from "@/lib/compliance/registry";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { writeTimelineEvent } from "@/lib/platform/automation/timeline";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const today = () => new Date().toISOString().split("T")[0];

export async function createTask(
  supabase: AuthClient,
  input: {
    projectId?: string | null;
    parentTaskId?: string | null;
    playbookStepId?: string | null;
    title: string;
    description?: string | null;
    taskType?: string;
    status?: WorkTaskStatus;
    priority?: string;
    riskLevel?: string;
    dueDate?: string | null;
    estimatedHours?: number | null;
    ownerUserId?: string | null;
    assigneeUserIds?: string[];
    schoolId?: string | null;
    studentId?: string | null;
    employeeId?: string | null;
    familyId?: string | null;
    tags?: string[];
    createsCompliance?: boolean;
    complianceCategoryKey?: string;
    createdBy?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("work_tasks")
    .insert({
      project_id: input.projectId ?? null,
      parent_task_id: input.parentTaskId ?? null,
      playbook_step_id: input.playbookStepId ?? null,
      title: input.title,
      description: input.description ?? null,
      task_type: input.taskType ?? "task",
      status: input.status ?? "not_started",
      priority: input.priority ?? "normal",
      risk_level: input.riskLevel ?? "medium",
      due_date: input.dueDate ?? null,
      estimated_hours: input.estimatedHours ?? null,
      owner_user_id: input.ownerUserId ?? input.createdBy ?? null,
      school_id: input.schoolId ?? null,
      student_id: input.studentId ?? null,
      employee_id: input.employeeId ?? null,
      family_id: input.familyId ?? null,
      tags: input.tags ?? [],
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const assignees = input.assigneeUserIds?.length
    ? input.assigneeUserIds
    : input.ownerUserId
      ? [input.ownerUserId]
      : input.createdBy
        ? [input.createdBy]
        : [];

  for (const userId of assignees) {
    await supabase.from("work_task_assignees").insert({
      task_id: data.id,
      user_id: userId,
      role: "assignee",
    });
  }

  if (input.createsCompliance && input.dueDate && input.complianceCategoryKey) {
    const result = await registerComplianceObligation(supabase, {
      schoolId: input.schoolId,
      categoryKey: input.complianceCategoryKey,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      ownerUserId: input.ownerUserId ?? input.createdBy,
      sourceModule: "work",
      sourceEntityType: "work_tasks",
      sourceEntityId: data.id,
    });
    if (result.id) {
      await supabase
        .from("work_tasks")
        .update({ compliance_obligation_id: result.id })
        .eq("id", data.id);
    }
  }

  if (input.priority === "critical" || input.riskLevel === "critical") {
    await createMissionControlItem(supabase, {
      schoolId: input.schoolId,
      module: "compliance",
      itemType: "compliance_alert",
      title: `Critical task: ${input.title}`,
      body: input.description ?? "",
      href: `/dashboard/work?view=tasks`,
      entityType: "work_tasks",
      entityId: data.id,
      assignedUserId: input.ownerUserId ?? input.createdBy,
      severity: "critical",
    });
  }

  await logWorkActivity(supabase, {
    projectId: input.projectId,
    taskId: data.id,
    actorUserId: input.createdBy,
    actionType: "task_created",
    summary: `Task created: ${input.title}`,
  });

  if (input.projectId) await updateProjectHealth(supabase, input.projectId);

  return { id: data.id };
}

export async function completeTask(
  supabase: AuthClient,
  taskId: string,
  actorUserId?: string | null
) {
  const { data: task } = await supabase.from("work_tasks").select("*").eq("id", taskId).single();
  if (!task) return { error: "Not found" };

  await supabase
    .from("work_tasks")
    .update({
      status: "completed",
      completion_pct: 100,
      completed_date: today(),
    })
    .eq("id", taskId);

  await recordStatusHistory(supabase, {
    entityType: "task",
    entityId: taskId,
    fromStatus: task.status,
    toStatus: "completed",
    changedBy: actorUserId,
  });

  await supabase
    .from("platform_mission_control_items")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("entity_type", "work_tasks")
    .eq("entity_id", taskId)
    .eq("is_resolved", false);

  if (task.compliance_obligation_id) {
    const { completeObligationAndScheduleNext } = await import("@/lib/compliance/registry");
    await completeObligationAndScheduleNext(supabase, task.compliance_obligation_id, actorUserId);
  }

  if (task.student_id) {
    await writeTimelineEvent(supabase, {
      schoolId: task.school_id,
      module: "compliance",
      entityType: "student",
      entityId: task.student_id,
      eventType: "task_completed",
      title: `Work completed: ${task.title}`,
      actorUserId,
      relatedEntityType: "work_tasks",
      relatedEntityId: taskId,
    });
  }

  await logWorkActivity(supabase, {
    projectId: task.project_id,
    taskId,
    actorUserId,
    actionType: "task_completed",
    summary: `Task completed: ${task.title}`,
  });

  if (task.project_id) await updateProjectHealth(supabase, task.project_id);

  return { success: true };
}

export async function updateTaskStatus(
  supabase: AuthClient,
  taskId: string,
  status: WorkTaskStatus,
  actorUserId?: string | null
) {
  const { data: task } = await supabase.from("work_tasks").select("status, project_id").eq("id", taskId).single();
  if (!task) return { error: "Not found" };

  await supabase.from("work_tasks").update({ status }).eq("id", taskId);
  await recordStatusHistory(supabase, {
    entityType: "task",
    entityId: taskId,
    fromStatus: task.status,
    toStatus: status,
    changedBy: actorUserId,
  });

  if (status === "completed") {
    return completeTask(supabase, taskId, actorUserId);
  }

  if (task.project_id) await updateProjectHealth(supabase, task.project_id);
  return { success: true };
}

export async function getTasks(
  supabase: AuthClient,
  filters?: {
    schoolId?: string;
    projectId?: string;
    ownerUserId?: string;
    assigneeUserId?: string;
    status?: string;
    limit?: number;
  }
) {
  let query = supabase
    .from("work_tasks")
    .select("*, work_projects(name, project_type)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(filters?.limit ?? 200);

  if (filters?.schoolId) query = query.eq("school_id", filters.schoolId);
  if (filters?.projectId) query = query.eq("project_id", filters.projectId);
  if (filters?.ownerUserId) query = query.eq("owner_user_id", filters.ownerUserId);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data } = await query;
  let tasks = (data ?? []) as WorkTask[];

  if (filters?.assigneeUserId) {
    const { data: assigned } = await supabase
      .from("work_task_assignees")
      .select("task_id")
      .eq("user_id", filters.assigneeUserId);
    const ids = new Set((assigned ?? []).map((a) => a.task_id));
    tasks = tasks.filter((t) => ids.has(t.id) || t.owner_user_id === filters.assigneeUserId);
  }

  return tasks;
}
