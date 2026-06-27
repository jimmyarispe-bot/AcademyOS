import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { WorkflowContext } from "@/lib/admissions/automation/context";
import { writeAuditLog } from "@/lib/admissions/automation/audit";
import {
  ACTION_TYPE_LABELS,
  type WorkflowActionType,
  type WorkflowStep,
} from "@/lib/admissions/automation/types";
import {
  processCommunicationQueue,
  scheduleApplicationIncompleteReminders,
  scheduleTourReminders,
  triggerCommunications,
} from "@/lib/admissions/communications/engine";
import type { CommunicationTriggerEvent } from "@/lib/admissions/communications/types";
import {
  notifyMissingDocumentsIfNeeded,
  notifyStateFundingNeeded,
  scheduleInterviewReminders,
} from "@/lib/admissions/communications/triggers";
import { generateEnrollmentPacket } from "@/lib/admissions/enrollment-packets";
import { sendTransactionalEmail } from "@/lib/platform/email/sendgrid";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface ExecuteActionOptions {
  supabase: AuthClient;
  ctx: WorkflowContext;
  step: WorkflowStep;
  sentBy: string | null;
  executionId: string | null;
}

async function resolveAssignee(
  supabase: AuthClient,
  ctx: WorkflowContext,
  assignTo: string | undefined
): Promise<string | null> {
  if (assignTo === "assigned_counselor") return ctx.assignedToUserId;
  if (assignTo === "school_leader") {
    const { data } = await supabase
      .from("user_schools")
      .select("user_id")
      .eq("school_id", ctx.schoolId)
      .limit(1);
    return data?.[0]?.user_id ?? null;
  }
  return ctx.assignedToUserId;
}

async function notifyStaffGroup(
  supabase: AuthClient,
  ctx: WorkflowContext,
  notificationType: string,
  title: string,
  body: string,
  userId?: string | null
) {
  await supabase.from("admissions_staff_notifications").insert({
    user_id: userId ?? ctx.assignedToUserId,
    school_id: ctx.schoolId,
    lead_id: ctx.leadId,
    application_id: ctx.applicationId,
    notification_type: notificationType,
    title,
    body,
  });
}

export async function executeWorkflowAction(
  options: ExecuteActionOptions
): Promise<{ success: boolean; error?: string }> {
  const { supabase, ctx, step, sentBy, executionId } = options;
  const actionType = step.action_type as WorkflowActionType | null;
  const config = step.config;

  if (!actionType) {
    return { success: true };
  }

  try {
    switch (actionType) {
      case "trigger_communications": {
        const events = (config.events as string[] | undefined) ?? [];
        for (const event of events) {
          await triggerCommunications(supabase, {
            leadId: ctx.leadId,
            applicationId: ctx.applicationId,
            triggerEvent: event as CommunicationTriggerEvent,
            mergeOverrides: ctx.mergeContext,
            sentBy,
          });
        }
        if (config.schedule_tour_reminders && ctx.metadata.tourScheduledAt) {
          await scheduleTourReminders(
            supabase,
            ctx.leadId,
            ctx.metadata.tourScheduledAt as string
          );
        }
        if (config.schedule_interview_reminders && ctx.metadata.interviewScheduledAt) {
          await scheduleInterviewReminders(
            supabase,
            ctx.leadId,
            ctx.applicationId,
            ctx.metadata.interviewScheduledAt as string
          );
        }
        if (config.schedule_incomplete_reminders && ctx.applicationId) {
          await scheduleApplicationIncompleteReminders(
            supabase,
            ctx.leadId,
            ctx.applicationId
          );
        }
        if (config.state_funding_check && ctx.applicationId) {
          await notifyStateFundingNeeded(supabase, ctx.leadId, ctx.applicationId, sentBy);
        }
        if (config.check_missing_documents && ctx.applicationId) {
          await notifyMissingDocumentsIfNeeded(
            supabase,
            ctx.leadId,
            ctx.applicationId,
            sentBy
          );
        }
        await processCommunicationQueue(supabase);
        break;
      }

      case "send_email":
      case "send_sms":
      case "send_portal_notification": {
        const channel =
          actionType === "send_email"
            ? "email"
            : actionType === "send_sms"
              ? "sms"
              : "portal_notification";
        const subject = (config.subject as string) ?? "Message from Admissions";
        const body = (config.body as string) ?? "";
        const sentTo =
          channel === "sms"
            ? (ctx.mergeContext.guardianPhone ?? "")
            : (ctx.mergeContext.guardianEmail ?? "");

        let deliveryStatus = channel === "portal_notification" ? "sent" : "pending";
        if (channel === "email" && sentTo) {
          const emailResult = await sendTransactionalEmail({ to: sentTo, subject, body });
          deliveryStatus = emailResult.success ? "sent" : "failed";
        } else if (channel === "sms") {
          deliveryStatus = "failed";
        }

        await supabase.from("admissions_communications").insert({
          lead_id: ctx.leadId,
          application_id: ctx.applicationId,
          communication_type: channel,
          subject,
          body,
          sent_to: sentTo,
          sent_by: sentBy,
          delivery_status: deliveryStatus,
          open_status: "unknown",
          trigger_event: "manual",
        });
        if (channel === "portal_notification") {
          await supabase.from("admissions_portal_notifications").insert({
            lead_id: ctx.leadId,
            application_id: ctx.applicationId,
            title: (config.subject as string) ?? "Notification",
            body: (config.body as string) ?? "",
          });
        }
        break;
      }

      case "create_internal_task": {
        const dueDays = Number(config.due_days) || 3;
        const dueDate = new Date(Date.now() + dueDays * 86400000)
          .toISOString()
          .split("T")[0];
        const assignee = await resolveAssignee(
          supabase,
          ctx,
          config.assign_to as string | undefined
        );
        await supabase.from("admissions_tasks").insert({
          lead_id: ctx.leadId,
          task_name: (config.task_name as string) ?? "Automation task",
          due_date: dueDate,
          task_status: "open",
          assigned_to_user_id: assignee,
        });
        break;
      }

      case "assign_staff":
      case "assign_school_leader": {
        const assignee = await resolveAssignee(
          supabase,
          ctx,
          actionType === "assign_school_leader" ? "school_leader" : "assigned_counselor"
        );
        if (assignee) {
          await supabase
            .from("admissions_leads")
            .update({ assigned_to_user_id: assignee })
            .eq("id", ctx.leadId);
        }
        break;
      }

      case "notify_finance":
      case "notify_scholarship_office":
      case "notify_executive":
      case "notify_admissions":
      case "notify_school_leader": {
        const title = (config.title as string) ?? `Automation: ${actionType}`;
        const body =
          (config.body as string) ??
          `Workflow notification for lead ${ctx.leadId}`;
        await notifyStaffGroup(supabase, ctx, actionType, title, body);
        break;
      }

      case "generate_enrollment_packet": {
        if (ctx.applicationId) {
          await generateEnrollmentPacket(ctx.applicationId, ctx.leadId);
        }
        break;
      }

      case "sync_checklist": {
        if (ctx.applicationId) {
          await supabase.rpc("sync_application_checklist", {
            p_application_id: ctx.applicationId,
          });
        }
        break;
      }

      case "schedule_reminder": {
        const delayHours = Number(config.delay_hours) || 24;
        await supabase.from("admissions_workflow_queue").insert({
          execution_id: executionId,
          lead_id: ctx.leadId,
          application_id: ctx.applicationId,
          trigger_event: (config.trigger as string) ?? "reminder",
          step_payload: config,
          scheduled_for: new Date(Date.now() + delayHours * 3600000).toISOString(),
          status: "pending",
        });
        break;
      }

      case "flag_executive_dashboard": {
        await writeAuditLog(supabase, {
          schoolId: ctx.schoolId,
          leadId: ctx.leadId,
          applicationId: ctx.applicationId,
          executionId,
          actorUserId: sentBy,
          eventType: "executive_flag",
          summary: "Lead flagged on executive dashboard",
          details: config,
        });
        const { recordExecutiveFlag } = await import(
          "@/lib/admissions/automation/platform-adapter"
        );
        await recordExecutiveFlag(supabase, ctx.schoolId, ctx.leadId, "Executive review required");
        break;
      }

      case "audit_log_entry": {
        await writeAuditLog(supabase, {
          schoolId: ctx.schoolId,
          leadId: ctx.leadId,
          applicationId: ctx.applicationId,
          executionId,
          actorUserId: sentBy,
          eventType: "workflow_step",
          summary: (config.summary as string) ?? "Workflow step completed",
          details: { step_id: step.id, action_type: actionType },
        });
        break;
      }

      case "create_student_record":
      case "create_family_record":
      case "create_sis_enrollment": {
        if (ctx.applicationId && actionType === "create_student_record") {
          const { convertAcceptedApplicantToStudent } = await import("@/lib/sis/conversion");
          await convertAcceptedApplicantToStudent(supabase, {
            applicationId: ctx.applicationId,
            leadId: ctx.leadId,
            convertedBy: sentBy,
            source: "automation",
          });
        } else {
          await writeAuditLog(supabase, {
            schoolId: ctx.schoolId,
            leadId: ctx.leadId,
            applicationId: ctx.applicationId,
            executionId,
            actorUserId: sentBy,
            eventType: actionType,
            summary: `${ACTION_TYPE_LABELS[actionType]} completed via workflow`,
            details: config,
          });
        }
        break;
      }

      case "generate_pdf":
      case "request_document":
      case "create_calendar_event":
      case "create_financial_account":
      case "create_scholarship_record":
      case "create_state_funding_record": {
        return {
          success: false,
          error: `${ACTION_TYPE_LABELS[actionType]} is not implemented in v1.0`,
        };
      }

      case "check_missing_documents":
      case "state_funding_check": {
        await writeAuditLog(supabase, {
          schoolId: ctx.schoolId,
          leadId: ctx.leadId,
          applicationId: ctx.applicationId,
          executionId,
          actorUserId: sentBy,
          eventType: actionType,
          summary: `${ACTION_TYPE_LABELS[actionType]} queued for integration`,
          details: config,
        });
        break;
      }

      default:
        break;
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Action failed",
    };
  }
}
