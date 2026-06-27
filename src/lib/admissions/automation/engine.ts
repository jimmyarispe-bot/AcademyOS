import type { createAuthClient } from "@/lib/supabase/server-auth";
import { buildWorkflowContext } from "@/lib/admissions/automation/context";
import { evaluateStepConditions } from "@/lib/admissions/automation/conditions";
import { executeWorkflowAction } from "@/lib/admissions/automation/actions";
import { writeAuditLog } from "@/lib/admissions/automation/audit";
import type {
  DispatchAutomationOptions,
  WorkflowDefinition,
  WorkflowStep,
} from "@/lib/admissions/automation/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

async function loadWorkflowsForTrigger(
  supabase: AuthClient,
  schoolId: string,
  trigger: string
): Promise<WorkflowDefinition[]> {
  const { data } = await supabase
    .from("admissions_workflows")
    .select("*")
    .eq("trigger_event", trigger)
    .eq("is_active", true)
    .eq("lifecycle_status", "active")
    .or(`school_id.is.null,school_id.eq.${schoolId}`)
    .order("sort_order");

  const workflows = (data ?? []) as WorkflowDefinition[];
  const byKey = new Map<string, WorkflowDefinition>();
  for (const w of workflows.sort((a, b) => (a.school_id ? 1 : 0) - (b.school_id ? 1 : 0))) {
    byKey.set(w.workflow_key, w);
  }
  return [...byKey.values()];
}

async function loadWorkflowSteps(
  supabase: AuthClient,
  workflowId: string
): Promise<WorkflowStep[]> {
  const { data } = await supabase
    .from("admissions_workflow_steps")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("is_active", true)
    .order("step_order");

  return (data ?? []) as WorkflowStep[];
}

async function runWorkflow(
  supabase: AuthClient,
  workflow: WorkflowDefinition,
  options: DispatchAutomationOptions,
  ctx: Awaited<ReturnType<typeof buildWorkflowContext>>
) {
  if (!ctx) return;

  const { data: execution, error: execError } = await supabase
    .from("admissions_workflow_executions")
    .insert({
      workflow_id: workflow.id,
      lead_id: options.leadId,
      application_id: options.applicationId ?? ctx.applicationId,
      trigger_event: options.trigger,
      status: "running",
      metadata: {
        tourScheduledAt: options.tourScheduledAt,
        interviewScheduledAt: options.interviewScheduledAt,
      },
    })
    .select("id")
    .single();

  if (execError || !execution) {
    console.error("[automation] execution insert:", execError?.message);
    return;
  }

  ctx.metadata = {
    ...ctx.metadata,
    tourScheduledAt: options.tourScheduledAt,
    interviewScheduledAt: options.interviewScheduledAt,
  };

  const steps = await loadWorkflowSteps(supabase, workflow.id);
  let hadFailure = false;
  let lastError: string | null = null;

  for (const step of steps) {
    if (step.step_type === "condition" && !evaluateStepConditions(ctx, step)) {
      continue;
    }

    if (step.step_type === "delay") {
      const delayHours = Number(step.config.delay_hours) || 0;
      if (delayHours > 0) {
        await supabase.from("admissions_workflow_queue").insert({
          execution_id: execution.id,
          workflow_id: workflow.id,
          workflow_step_id: step.id,
          lead_id: options.leadId,
          application_id: ctx.applicationId,
          trigger_event: options.trigger,
          step_payload: { resume_from_step: step.step_order + 1, ...step.config },
          scheduled_for: new Date(Date.now() + delayHours * 3600000).toISOString(),
          status: "pending",
        });
        break;
      }
      continue;
    }

    if (step.step_type === "escalation") {
      const afterHours = Number(step.config.after_hours) || 72;
      await supabase.from("admissions_workflow_queue").insert({
        execution_id: execution.id,
        workflow_id: workflow.id,
        workflow_step_id: step.id,
        lead_id: options.leadId,
        application_id: ctx.applicationId,
        trigger_event: `escalation:${options.trigger}`,
        step_payload: step.config,
        scheduled_for: new Date(Date.now() + afterHours * 3600000).toISOString(),
        status: "pending",
      });
      continue;
    }

    const result = await executeWorkflowAction({
      supabase,
      ctx,
      step,
      sentBy: options.sentBy ?? null,
      executionId: execution.id,
    });

    if (!result.success) {
      hadFailure = true;
      lastError = result.error ?? "Unknown error";
    }
  }

  await supabase
    .from("admissions_workflow_executions")
    .update({
      status: hadFailure ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      error_message: lastError,
    })
    .eq("id", execution.id);

  await writeAuditLog(supabase, {
    schoolId: ctx.schoolId,
    leadId: options.leadId,
    applicationId: ctx.applicationId,
    executionId: execution.id,
    actorUserId: options.sentBy ?? null,
    eventType: "workflow_completed",
    summary: `Workflow "${workflow.name}" ${hadFailure ? "failed" : "completed"}`,
    details: { workflow_key: workflow.workflow_key, trigger: options.trigger },
  });
}

export async function runWorkflowEngine(
  supabase: AuthClient,
  options: DispatchAutomationOptions
): Promise<boolean> {
  const ctx = await buildWorkflowContext(
    supabase,
    options.leadId,
    options.applicationId,
    options.mergeOverrides
  );

  if (!ctx) return false;

  const workflows = await loadWorkflowsForTrigger(
    supabase,
    ctx.schoolId,
    options.trigger
  );

  if (workflows.length === 0) return false;

  for (const workflow of workflows) {
    await runWorkflow(supabase, workflow, options, ctx);
  }

  return true;
}
