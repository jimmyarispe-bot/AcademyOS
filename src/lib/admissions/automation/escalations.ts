import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { WorkflowContext } from "@/lib/admissions/automation/context";
import { writeAuditLog } from "@/lib/admissions/automation/audit";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

interface EscalationAction {
  type: string;
  task_name?: string;
  due_days?: number;
}

export async function runEscalationActions(
  supabase: AuthClient,
  ctx: WorkflowContext,
  config: Record<string, unknown>
) {
  const actions = (config.actions as EscalationAction[] | undefined) ?? [];

  for (const action of actions) {
    switch (action.type) {
      case "notify_admissions":
      case "notify_school_leader": {
        await supabase.from("admissions_staff_notifications").insert({
          user_id: ctx.assignedToUserId,
          school_id: ctx.schoolId,
          lead_id: ctx.leadId,
          application_id: ctx.applicationId,
          notification_type: action.type,
          title: `Escalation: ${action.type.replace(/_/g, " ")}`,
          body: `Escalation triggered for lead requiring follow-up.`,
        });
        break;
      }
      case "create_internal_task": {
        const dueDays = action.due_days ?? 1;
        await supabase.from("admissions_tasks").insert({
          lead_id: ctx.leadId,
          task_name: action.task_name ?? "Escalation follow-up",
          due_date: new Date(Date.now() + dueDays * 86400000).toISOString().split("T")[0],
          task_status: "open",
          assigned_to_user_id: ctx.assignedToUserId,
        });
        break;
      }
      case "flag_executive_dashboard": {
        await writeAuditLog(supabase, {
          schoolId: ctx.schoolId,
          leadId: ctx.leadId,
          applicationId: ctx.applicationId,
          eventType: "escalation_executive_flag",
          summary: "Executive dashboard flag from escalation rule",
          details: config,
        });
        break;
      }
      default:
        break;
    }
  }
}

export async function scheduleEscalationsForTrigger(
  supabase: AuthClient,
  schoolId: string,
  triggerEvent: string,
  leadId: string,
  applicationId: string | null
) {
  const { data: rules } = await supabase
    .from("admissions_escalation_rules")
    .select("*")
    .eq("trigger_event", triggerEvent)
    .eq("is_active", true)
    .or(`school_id.is.null,school_id.eq.${schoolId}`);

  for (const rule of rules ?? []) {
    await supabase.from("admissions_workflow_queue").insert({
      lead_id: leadId,
      application_id: applicationId,
      trigger_event: `escalation:${triggerEvent}`,
      step_payload: { actions: rule.actions, rule_key: rule.rule_key },
      scheduled_for: new Date(
        Date.now() + (rule.after_hours ?? 72) * 3600000
      ).toISOString(),
      status: "pending",
    });
  }
}
