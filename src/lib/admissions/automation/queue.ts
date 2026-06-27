import type { createAuthClient } from "@/lib/supabase/server-auth";
import { buildWorkflowContext } from "@/lib/admissions/automation/context";
import { executeWorkflowAction } from "@/lib/admissions/automation/actions";
import { runEscalationActions } from "@/lib/admissions/automation/escalations";
import type { WorkflowStep } from "@/lib/admissions/automation/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function processWorkflowQueue(supabase: AuthClient) {
  const now = new Date().toISOString();

  const { data: pending } = await supabase
    .from("admissions_workflow_queue")
    .select("*")
    .in("status", ["pending", "processing"])
    .lte("scheduled_for", now)
    .order("scheduled_for")
    .limit(50);

  for (const item of pending ?? []) {
    await supabase
      .from("admissions_workflow_queue")
      .update({ status: "processing" })
      .eq("id", item.id);

    try {
      const ctx = await buildWorkflowContext(
        supabase,
        item.lead_id,
        item.application_id
      );

      if (!ctx) {
        throw new Error("Could not build workflow context");
      }

      if (String(item.trigger_event).startsWith("escalation:")) {
        await runEscalationActions(supabase, ctx, item.step_payload as Record<string, unknown>);
      } else if (item.workflow_step_id) {
        const { data: step } = await supabase
          .from("admissions_workflow_steps")
          .select("*")
          .eq("id", item.workflow_step_id)
          .single();

        if (step) {
          const result = await executeWorkflowAction({
            supabase,
            ctx,
            step: step as WorkflowStep,
            sentBy: null,
            executionId: item.execution_id,
          });
          if (!result.success) throw new Error(result.error);
        }
      } else {
        const payload = item.step_payload as Record<string, unknown>;
        if (payload.resume_action === "trigger_communications") {
          await executeWorkflowAction({
            supabase,
            ctx,
            step: {
              id: item.id,
              workflow_id: item.workflow_id ?? "",
              step_order: 0,
              step_type: "action",
              action_type: "trigger_communications",
              config: (payload.resume_config as Record<string, unknown>) ?? {},
              is_active: true,
            },
            sentBy: null,
            executionId: item.execution_id,
          });
        }
      }

      await supabase
        .from("admissions_workflow_queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    } catch (err) {
      const retryCount = (item.retry_count ?? 0) + 1;
      const maxRetries = item.max_retries ?? 3;
      const errorMessage = err instanceof Error ? err.message : "Queue processing failed";

      if (retryCount >= maxRetries) {
        await supabase
          .from("admissions_workflow_queue")
          .update({
            status: "failed",
            retry_count: retryCount,
            last_error: errorMessage,
          })
          .eq("id", item.id);
      } else {
        await supabase
          .from("admissions_workflow_queue")
          .update({
            status: "pending",
            retry_count: retryCount,
            last_error: errorMessage,
            scheduled_for: new Date(Date.now() + retryCount * 15 * 60000).toISOString(),
          })
          .eq("id", item.id);
      }
    }
  }
}
