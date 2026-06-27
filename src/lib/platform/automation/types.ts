/** AcademyOS platform modules supported by the automation engine */
export const PLATFORM_MODULES = [
  "admissions",
  "sis",
  "scholarships",
  "state_funding",
  "finance",
  "hr",
  "employees",
  "scheduling",
  "classes",
  "parent_portal",
  "teacher_portal",
  "executive",
  "mission_control",
  "compliance",
  "work",
] as const;

export type PlatformModule = (typeof PLATFORM_MODULES)[number];

export const MODULE_LABELS: Record<PlatformModule, string> = {
  admissions: "Admissions",
  sis: "Student Success (SSIS)",
  scholarships: "Scholarships",
  state_funding: "State Funding",
  finance: "Finance & Billing",
  hr: "Human Resources",
  employees: "Employee Management",
  scheduling: "Scheduling",
  classes: "Classes",
  parent_portal: "Parent Portal",
  teacher_portal: "Teacher Portal",
  executive: "Executive Dashboard",
  mission_control: "Mission Control",
  compliance: "Enterprise Compliance",
  work: "Enterprise Work Management",
};

export const WORKFLOW_LIFECYCLE_STATUSES = [
  "draft",
  "testing",
  "active",
  "archived",
] as const;

export type WorkflowLifecycleStatus = (typeof WORKFLOW_LIFECYCLE_STATUSES)[number];

export const QUEUE_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "retrying",
  "cancelled",
] as const;

export type QueueJobStatus = (typeof QUEUE_JOB_STATUSES)[number];

export const NOTIFICATION_CHANNELS = [
  "email",
  "sms",
  "portal_notification",
  "dashboard_notification",
  "teacher_portal_notification",
  "push_notification",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const TIMELINE_EVENT_TYPES = [
  "email",
  "sms",
  "portal_message",
  "phone_call",
  "task",
  "document",
  "workflow",
  "status_change",
  "approval",
  "note",
  "system",
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export const MISSION_CONTROL_ITEM_TYPES = [
  "pending_task",
  "overdue_task",
  "failed_automation",
  "funding_alert",
  "scholarship_alert",
  "admissions_alert",
  "finance_alert",
  "hr_alert",
  "scheduling_alert",
  "teacher_compliance_alert",
  "executive_alert",
  "compliance_alert",
  "escalation",
] as const;

export type MissionControlItemType = (typeof MISSION_CONTROL_ITEM_TYPES)[number];

export const TEMPLATE_CATEGORIES = [
  "admissions",
  "scholarships",
  "funding",
  "finance",
  "hr",
  "payroll",
  "scheduling",
  "enrollment",
  "emergency",
  "general",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface PlatformEntityRef {
  module: PlatformModule;
  entityType: string;
  entityId: string;
  schoolId?: string | null;
}

export interface WorkflowStepDefinition {
  step_order: number;
  step_type: "condition" | "action" | "delay" | "notification" | "escalation" | "approval";
  action_type?: string | null;
  config: Record<string, unknown>;
}

export interface MarketplaceWorkflowTemplate {
  id: string;
  marketplace_key: string;
  name: string;
  description: string | null;
  module: PlatformModule;
  category: string;
  trigger_event: string;
  workflow_definition: Record<string, unknown>;
  step_definitions: WorkflowStepDefinition[];
  tags: string[];
}
