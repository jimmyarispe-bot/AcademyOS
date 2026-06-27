import type { PlatformModule } from "@/lib/platform/automation/types";

export type ActionHandler = (
  context: Record<string, unknown>
) => Promise<{ success: boolean; error?: string; auditSummary?: string }>;

/** Cross-module action registry — modules register handlers at runtime */
const ACTION_REGISTRY: Partial<Record<string, ActionHandler>> = {};

export function registerPlatformAction(actionType: string, handler: ActionHandler) {
  ACTION_REGISTRY[actionType] = handler;
}

export function getPlatformAction(actionType: string): ActionHandler | undefined {
  return ACTION_REGISTRY[actionType];
}

/** Actions implemented today vs integration-ready stubs */
export const PLATFORM_ACTIONS: Record<
  string,
  { module: PlatformModule | "platform"; label: string; status: "live" | "stub" }
> = {
  trigger_communications: { module: "admissions", label: "Run Communication Templates", status: "live" },
  create_internal_task: { module: "admissions", label: "Create Internal Task", status: "live" },
  send_email: { module: "platform", label: "Send Email", status: "live" },
  send_sms: { module: "platform", label: "Send SMS", status: "live" },
  send_portal_notification: { module: "platform", label: "Portal Notification", status: "live" },
  generate_enrollment_packet: { module: "admissions", label: "Generate Enrollment Packet", status: "live" },
  sync_checklist: { module: "admissions", label: "Sync Checklist", status: "live" },
  audit_log_entry: { module: "platform", label: "Audit Log Entry", status: "live" },
  flag_executive_dashboard: { module: "executive", label: "Flag Executive Dashboard", status: "live" },
  create_student_record: { module: "sis", label: "Create Student Record", status: "live" },
  create_family_record: { module: "sis", label: "Create Family Record", status: "live" },
  create_financial_account: { module: "finance", label: "Create Financial Account", status: "stub" },
  create_scholarship_record: { module: "scholarships", label: "Create Scholarship Record", status: "stub" },
  create_state_funding_record: { module: "state_funding", label: "Create State Funding Record", status: "stub" },
  create_sis_enrollment: { module: "sis", label: "Create SIS Enrollment", status: "live" },
  notify_finance: { module: "finance", label: "Notify Finance", status: "stub" },
  notify_scholarship_office: { module: "scholarships", label: "Notify Scholarship Office", status: "stub" },
  notify_executive: { module: "executive", label: "Notify Executive Team", status: "stub" },
  generate_pdf: { module: "platform", label: "Generate PDF", status: "stub" },
  request_document: { module: "platform", label: "Request Document", status: "stub" },
  create_calendar_event: { module: "scheduling", label: "Create Calendar Event", status: "stub" },
  schedule_reminder: { module: "platform", label: "Schedule Reminder", status: "live" },
  request_approval: { module: "platform", label: "Request Approval", status: "stub" },
};

export async function executeRegisteredAction(
  actionType: string,
  context: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const handler = getPlatformAction(actionType);
  if (!handler) {
    const meta = PLATFORM_ACTIONS[actionType];
    if (meta?.status === "stub") {
      return {
        success: false,
        error: `Action "${actionType}" is not implemented in v1.0 (${meta.label})`,
      };
    }
    return { success: false, error: `Unknown action: ${actionType}` };
  }
  return handler(context);
}
