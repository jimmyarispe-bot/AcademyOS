"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePermission } from "@/lib/platform/identity/permissions";
import { writePlatformAudit } from "@/lib/platform/automation/audit";
import { createProject } from "@/lib/work/projects";
import { createTask, completeTask, updateTaskStatus } from "@/lib/work/tasks";
import { executePlaybook } from "@/lib/work/playbooks";
import type { WorkProjectStatus, WorkTaskStatus } from "@/lib/work/types";

async function assertManage() {
  const supabase = await createAuthClient();
  const gate = await requirePermission(supabase, "work.manage");
  if (!gate.ok) return null;
  return supabase;
}

export async function createProjectAction(formData: FormData): Promise<void> {
  const supabase = await assertManage();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();

  const result = await createProject(supabase, {
    schoolId: (formData.get("school_id") as string) || null,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    projectType: (formData.get("project_type") as string) || "custom",
    priority: (formData.get("priority") as string) || "normal",
    ownerUserId: (formData.get("owner_user_id") as string) || user?.id || null,
    targetDate: (formData.get("target_date") as string) || null,
    createdBy: user?.id,
  });

  if (result.error || !result.id) return;

  await writePlatformAudit(supabase, {
    module: "work",
    actionType: "work_project_created",
    summary: `Project created: ${formData.get("name")}`,
    entityType: "work_projects",
    entityId: result.id,
  });

  revalidatePath("/dashboard/work");
  revalidatePath("/dashboard/projects");
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const supabase = await assertManage();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();

  await createTask(supabase, {
    projectId: (formData.get("project_id") as string) || null,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    priority: (formData.get("priority") as string) || "normal",
    dueDate: (formData.get("due_date") as string) || null,
    ownerUserId: (formData.get("owner_user_id") as string) || user?.id || null,
    schoolId: (formData.get("school_id") as string) || null,
    createdBy: user?.id,
  });

  revalidatePath("/dashboard/work");
  revalidatePath("/dashboard/tasks");
}

export async function completeTaskAction(taskId: string) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const result = await completeTask(supabase, taskId, user.id);
  if (result.error) return result;

  revalidatePath("/dashboard/work");
  revalidatePath("/dashboard/tasks");
  return { success: true };
}

export async function updateTaskStatusAction(taskId: string, status: WorkTaskStatus) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const result = await updateTaskStatus(supabase, taskId, status, user.id);
  if (result.error) return result;

  revalidatePath("/dashboard/work");
  revalidatePath("/dashboard/tasks");
  return { success: true };
}

export async function executePlaybookAction(formData: FormData): Promise<void> {
  const supabase = await assertManage();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();

  await executePlaybook(supabase, {
    playbookId: formData.get("playbook_id") as string,
    schoolId: (formData.get("school_id") as string) || null,
    ownerUserId: (formData.get("owner_user_id") as string) || user?.id || null,
    startedBy: user?.id,
    projectName: (formData.get("project_name") as string) || undefined,
    studentId: (formData.get("student_id") as string) || null,
    employeeId: (formData.get("employee_id") as string) || null,
  });

  revalidatePath("/dashboard/playbooks");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/work");
}

export async function logTimeEntryAction(formData: FormData): Promise<void> {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const taskId = formData.get("task_id") as string;
  const hours = Number(formData.get("hours"));

  await supabase.from("work_time_entries").insert({
    task_id: taskId,
    project_id: (formData.get("project_id") as string) || null,
    user_id: user.id,
    hours,
    is_billable: formData.get("is_billable") === "true",
    funding_source: (formData.get("funding_source") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });

  const { data: task } = await supabase.from("work_tasks").select("actual_hours").eq("id", taskId).single();
  if (task) {
    await supabase
      .from("work_tasks")
      .update({ actual_hours: Number(task.actual_hours ?? 0) + hours })
      .eq("id", taskId);
  }

  revalidatePath("/dashboard/work");
}

export async function updateProjectStatusAction(projectId: string, status: WorkProjectStatus): Promise<void> {
  const supabase = await assertManage();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  const { updateProjectStatus } = await import("@/lib/work/projects");
  await updateProjectStatus(supabase, projectId, status, user?.id);
  revalidatePath("/dashboard/projects");
}
