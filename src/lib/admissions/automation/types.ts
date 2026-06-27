export const WORKFLOW_TRIGGER_EVENTS = [
  "inquiry_submitted",
  "inquiry_updated",
  "tour_scheduled",
  "tour_completed",
  "application_started",
  "application_saved",
  "application_submitted",
  "documents_uploaded",
  "missing_documents",
  "state_funding_selected",
  "award_letter_uploaded",
  "funding_verified",
  "funding_rejected",
  "financial_aid_requested",
  "financial_aid_submitted",
  "interview_scheduled",
  "interview_completed",
  "admissions_decision",
  "accepted",
  "waitlisted",
  "declined",
  "enrollment_packet_sent",
  "enrollment_completed",
] as const;

export type WorkflowTriggerEvent = (typeof WORKFLOW_TRIGGER_EVENTS)[number];

export const WORKFLOW_ACTION_TYPES = [
  "send_email",
  "send_sms",
  "send_portal_notification",
  "trigger_communications",
  "create_internal_task",
  "assign_staff",
  "assign_school_leader",
  "notify_finance",
  "notify_scholarship_office",
  "notify_executive",
  "notify_admissions",
  "notify_school_leader",
  "generate_pdf",
  "generate_enrollment_packet",
  "request_document",
  "create_calendar_event",
  "schedule_reminder",
  "sync_checklist",
  "create_student_record",
  "create_family_record",
  "create_financial_account",
  "create_scholarship_record",
  "create_state_funding_record",
  "create_sis_enrollment",
  "audit_log_entry",
  "flag_executive_dashboard",
  "check_missing_documents",
  "state_funding_check",
] as const;

export type WorkflowActionType = (typeof WORKFLOW_ACTION_TYPES)[number];

export const WORKFLOW_STEP_TYPES = [
  "condition",
  "action",
  "delay",
  "notification",
  "escalation",
] as const;

export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number];

export const TEMPLATE_CATEGORIES = [
  "inquiry",
  "tour",
  "application",
  "funding",
  "financial_aid",
  "interview",
  "acceptance",
  "waitlist",
  "denial",
  "enrollment",
  "emergency",
  "general",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TRIGGER_EVENT_LABELS: Record<WorkflowTriggerEvent, string> = {
  inquiry_submitted: "Inquiry Submitted",
  inquiry_updated: "Inquiry Updated",
  tour_scheduled: "Tour Scheduled",
  tour_completed: "Tour Completed",
  application_started: "Application Started",
  application_saved: "Application Saved",
  application_submitted: "Application Submitted",
  documents_uploaded: "Documents Uploaded",
  missing_documents: "Missing Documents",
  state_funding_selected: "State Funding Selected",
  award_letter_uploaded: "Award Letter Uploaded",
  funding_verified: "Funding Verified",
  funding_rejected: "Funding Rejected",
  financial_aid_requested: "Financial Aid Requested",
  financial_aid_submitted: "Financial Aid Submitted",
  interview_scheduled: "Interview Scheduled",
  interview_completed: "Interview Completed",
  admissions_decision: "Admissions Decision",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  declined: "Declined",
  enrollment_packet_sent: "Enrollment Packet Sent",
  enrollment_completed: "Enrollment Completed",
};

export const ACTION_TYPE_LABELS: Record<WorkflowActionType, string> = {
  send_email: "Send Email",
  send_sms: "Send SMS",
  send_portal_notification: "Send Portal Notification",
  trigger_communications: "Run Communication Templates",
  create_internal_task: "Create Internal Task",
  assign_staff: "Assign Staff Member",
  assign_school_leader: "Assign School Leader",
  notify_finance: "Notify Finance",
  notify_scholarship_office: "Notify Scholarship Office",
  notify_executive: "Notify Executive Team",
  notify_admissions: "Notify Admissions",
  notify_school_leader: "Notify School Leader",
  generate_pdf: "Generate PDF",
  generate_enrollment_packet: "Generate Enrollment Packet",
  request_document: "Request Document",
  create_calendar_event: "Create Calendar Event",
  schedule_reminder: "Schedule Reminder",
  sync_checklist: "Sync Application Checklist",
  create_student_record: "Create Student Record",
  create_family_record: "Create Family Record",
  create_financial_account: "Create Financial Account",
  create_scholarship_record: "Create Scholarship Record",
  create_state_funding_record: "Create State Funding Record",
  create_sis_enrollment: "Create SIS Enrollment",
  audit_log_entry: "Audit Log Entry",
  flag_executive_dashboard: "Flag Executive Dashboard",
  check_missing_documents: "Check Missing Documents",
  state_funding_check: "State Funding Check",
};

/** Maps workflow triggers to legacy communication trigger events */
export const WORKFLOW_TO_COMMUNICATION_EVENTS: Partial<
  Record<WorkflowTriggerEvent, string[]>
> = {
  inquiry_submitted: ["inquiry_submitted", "staff_new_inquiry"],
  tour_scheduled: ["tour_scheduled"],
  application_started: ["application_started", "staff_application_started"],
  application_submitted: ["application_submitted", "staff_application_submitted"],
  documents_uploaded: ["staff_documents_uploaded", "missing_documents"],
  funding_verified: ["funding_verification_approved", "staff_funding_verified"],
  funding_rejected: ["funding_verification_rejected"],
  financial_aid_submitted: [
    "financial_aid_documents_requested",
    "staff_financial_aid_submitted",
  ],
  interview_scheduled: ["interview_scheduled", "staff_interview_scheduled"],
  accepted: ["student_accepted", "staff_application_accepted"],
  waitlisted: ["student_waitlisted"],
  declined: ["student_declined"],
  enrollment_completed: ["enrollment_completed"],
  missing_documents: ["missing_documents"],
};

export interface WorkflowDefinition {
  id: string;
  school_id: string | null;
  workflow_key: string;
  name: string;
  description: string | null;
  trigger_event: WorkflowTriggerEvent;
  category: string;
  is_active: boolean;
  sort_order: number;
  version_number: number;
  lifecycle_status?: string;
  module?: string;
  parent_workflow_id?: string | null;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  step_type: WorkflowStepType;
  action_type: WorkflowActionType | null;
  config: Record<string, unknown>;
  is_active: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string | null;
  lead_id: string;
  application_id: string | null;
  trigger_event: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface WorkflowQueueItem {
  id: string;
  execution_id: string | null;
  workflow_id: string | null;
  workflow_step_id: string | null;
  lead_id: string;
  application_id: string | null;
  trigger_event: string;
  step_payload: Record<string, unknown>;
  scheduled_for: string;
  status: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
}

export interface AutomationAuditEntry {
  id: string;
  school_id: string | null;
  lead_id: string | null;
  application_id: string | null;
  execution_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  event_category: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
  users?: { full_name: string | null } | null;
}

export interface DispatchAutomationOptions {
  trigger: WorkflowTriggerEvent;
  leadId: string;
  applicationId?: string | null;
  sentBy?: string | null;
  mergeOverrides?: Record<string, unknown>;
  tourScheduledAt?: string;
  interviewScheduledAt?: string;
  skipLegacyFallback?: boolean;
}

export interface AutomationDashboardMetrics {
  pendingAutomations: number;
  failedAutomations: number;
  upcomingReminders: number;
  completedToday: number;
  avgResponseHours: number | null;
  applicationAgingDays: number | null;
  deliveryLogged: number;
  deliverySent: number;
}
