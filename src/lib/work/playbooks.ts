import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { WorkPlaybook } from "@/lib/work/types";
import { createProject } from "@/lib/work/projects";
import { createTask } from "@/lib/work/tasks";
import { logWorkActivity } from "@/lib/work/activity";
import { writeTimelineEvent } from "@/lib/platform/automation/timeline";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export async function getPlaybooks(supabase: AuthClient, schoolId?: string) {
  let query = supabase
    .from("work_playbooks")
    .select("*, work_playbook_steps(count)")
    .eq("is_active", true)
    .order("name");

  if (schoolId) {
    query = query.or(`school_id.is.null,school_id.eq.${schoolId}`);
  } else {
    query = query.is("school_id", null);
  }

  const { data } = await query;
  return (data ?? []) as WorkPlaybook[];
}

export async function getPlaybookWithSteps(supabase: AuthClient, playbookId: string) {
  const [{ data: playbook }, { data: steps }] = await Promise.all([
    supabase.from("work_playbooks").select("*").eq("id", playbookId).single(),
    supabase
      .from("work_playbook_steps")
      .select("*")
      .eq("playbook_id", playbookId)
      .order("step_order"),
  ]);

  return { playbook, steps: steps ?? [] };
}

export interface ExecutePlaybookInput {
  playbookId: string;
  schoolId?: string | null;
  ownerUserId?: string | null;
  startedBy?: string | null;
  projectName?: string;
  startDate?: string;
  studentId?: string | null;
  employeeId?: string | null;
  familyId?: string | null;
}

/** Running a playbook creates project, tasks, deadlines, and integrations */
export async function executePlaybook(supabase: AuthClient, input: ExecutePlaybookInput) {
  const { playbook, steps } = await getPlaybookWithSteps(supabase, input.playbookId);
  if (!playbook) return { error: "Playbook not found" };

  const startDate = input.startDate ?? new Date().toISOString().split("T")[0];

  const { data: run, error: runError } = await supabase
    .from("work_playbook_runs")
    .insert({
      playbook_id: input.playbookId,
      school_id: input.schoolId ?? playbook.school_id,
      status: "running",
      started_by: input.startedBy ?? null,
    })
    .select("id")
    .single();

  if (runError) return { error: runError.message };

  const projectResult = await createProject(supabase, {
    schoolId: input.schoolId ?? playbook.school_id,
    name: input.projectName ?? playbook.name,
    description: playbook.description,
    projectType: playbook.project_type,
    ownerUserId: input.ownerUserId ?? input.startedBy,
    startDate,
    targetDate: playbook.estimated_duration_days
      ? addDays(startDate, playbook.estimated_duration_days)
      : null,
    playbookId: playbook.id,
    playbookRunId: run.id,
    studentId: input.studentId,
    employeeId: input.employeeId,
    familyId: input.familyId,
    sourceModule: "work",
    sourceEntityType: "work_playbook_runs",
    sourceEntityId: run.id,
    createdBy: input.startedBy,
  });

  if (projectResult.error || !projectResult.id) {
    return { error: projectResult.error ?? "Failed to create project" };
  }

  await supabase
    .from("work_playbook_runs")
    .update({ project_id: projectResult.id })
    .eq("id", run.id);

  const taskIds: string[] = [];

  for (const step of steps) {
    const dueDate = addDays(startDate, step.offset_days ?? 0);
    const taskResult = await createTask(supabase, {
      projectId: projectResult.id,
      playbookStepId: step.id,
      title: step.title,
      description: step.description,
      taskType: step.task_type,
      priority: step.default_priority,
      riskLevel: step.default_risk,
      dueDate,
      estimatedHours: step.estimated_hours,
      ownerUserId: input.ownerUserId ?? input.startedBy,
      schoolId: input.schoolId ?? playbook.school_id,
      studentId: input.studentId,
      employeeId: input.employeeId,
      familyId: input.familyId,
      createsCompliance: step.creates_compliance,
      complianceCategoryKey: step.compliance_category_key ?? "governance",
      createdBy: input.startedBy,
    });

    if (taskResult.id) {
      taskIds.push(taskResult.id);

      const checklist = step.checklist as { label: string }[] | null;
      if (checklist?.length) {
        const { data: cl } = await supabase
          .from("work_task_checklists")
          .insert({ task_id: taskResult.id, title: "Checklist" })
          .select("id")
          .single();

        if (cl) {
          await supabase.from("work_checklist_items").insert(
            checklist.map((item, i) => ({
              checklist_id: cl.id,
              label: item.label,
              sort_order: i,
            }))
          );
        }
      }
    }
  }

  await logWorkActivity(supabase, {
    projectId: projectResult.id,
    actorUserId: input.startedBy,
    actionType: "playbook_executed",
    summary: `Playbook executed: ${playbook.name}`,
    metadata: { playbook_id: playbook.id, run_id: run.id, task_count: taskIds.length },
  });

  await writeTimelineEvent(supabase, {
    schoolId: input.schoolId ?? playbook.school_id,
    module: "work",
    entityType: "work_projects",
    entityId: projectResult.id,
    eventType: "playbook_started",
    title: `Playbook started: ${playbook.name}`,
    actorUserId: input.startedBy,
    metadata: { playbook_key: playbook.playbook_key },
  });

  await supabase
    .from("work_playbook_runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", run.id);

  return { projectId: projectResult.id, runId: run.id, taskIds };
}
