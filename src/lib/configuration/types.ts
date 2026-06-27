export type ConfigSectionKey =
  | "organization"
  | "branding"
  | "academic"
  | "admissions"
  | "finance"
  | "hr"
  | "communications"
  | "workflows"
  | "integrations"
  | "security"
  | "automation"
  | "compliance"
  | "playbooks"
  | "mission_control"
  | "executive"
  | "scheduling"
  | "portals";

export type GoLiveStatus = "green" | "yellow" | "red" | "pending";
export type ModuleInstallStatus = "installed" | "enabled" | "disabled" | "uninstalled";

export const SETUP_WIZARD_STEPS = [
  { key: "organization", label: "Organization" },
  { key: "branding", label: "Branding" },
  { key: "schools", label: "Schools" },
  { key: "campuses", label: "Campuses" },
  { key: "programs", label: "Programs" },
  { key: "academic_calendar", label: "Academic Calendar" },
  { key: "school_year", label: "School Year" },
  { key: "bell_schedule", label: "Bell Schedule" },
  { key: "departments", label: "Departments" },
  { key: "roles", label: "Roles" },
  { key: "permissions", label: "Permissions" },
  { key: "admissions", label: "Admissions" },
  { key: "finance", label: "Finance" },
  { key: "scholarships", label: "Scholarships" },
  { key: "state_funding", label: "State Funding" },
  { key: "communications", label: "Communications" },
  { key: "automation", label: "Automation" },
  { key: "compliance", label: "Compliance" },
  { key: "playbooks", label: "Playbooks" },
  { key: "mission_control", label: "Mission Control" },
  { key: "executive", label: "Executive Dashboards" },
  { key: "review", label: "Review" },
  { key: "launch", label: "Launch" },
] as const;

export type SetupStepKey = (typeof SETUP_WIZARD_STEPS)[number]["key"];

export interface GoLiveCheck {
  checkKey: string;
  checkCategory: string;
  title: string;
  status: GoLiveStatus;
  message?: string;
  resolveHref?: string;
  isRequired: boolean;
}

export interface ConfigModuleRow {
  moduleKey: string;
  displayName: string;
  description?: string;
  category: string;
  dependencies: string[];
  status: ModuleInstallStatus;
  installedVersion?: string;
}

export const CONFIG_STUDIO_NAV = [
  { href: "/dashboard/admin/configuration", label: "Studio Home", exact: true },
  { href: "/dashboard/admin/setup", label: "Setup Wizard" },
  { href: "/dashboard/admin/modules", label: "Modules" },
  { href: "/dashboard/admin/branding", label: "Branding" },
  { href: "/dashboard/admin/organization", label: "Organization" },
  { href: "/dashboard/admin/campuses", label: "Campuses" },
  { href: "/dashboard/admin/programs", label: "Programs" },
  { href: "/dashboard/admin/calendars", label: "Calendars" },
  { href: "/dashboard/admin/academic", label: "Academic" },
  { href: "/dashboard/admin/admissions", label: "Admissions" },
  { href: "/dashboard/admin/finance", label: "Finance" },
  { href: "/dashboard/admin/hr", label: "HR" },
  { href: "/dashboard/admin/workflows", label: "Workflows" },
  { href: "/dashboard/admin/playbooks", label: "Playbooks" },
  { href: "/dashboard/admin/communications", label: "Communications" },
  { href: "/dashboard/admin/templates", label: "Templates" },
  { href: "/dashboard/admin/security", label: "Security" },
  { href: "/dashboard/admin/integrations", label: "Integrations" },
  { href: "/dashboard/admin/go-live", label: "Go Live" },
] as const;

export const CONFIG_AI_CAPABILITIES = [
  "recommend_configuration_improvements",
  "optimize_workflows",
  "security_improvements",
  "financial_settings",
  "academic_settings",
  "automation_improvements",
] as const;

export const DEFAULT_ORGANIZATION_CONFIG = {
  legal_name: "",
  tax_id: "",
  website: "",
  mission: "",
  vision: "",
  core_values: [] as string[],
  accreditation: "",
  timezone: "America/New_York",
  languages: ["en"],
  currencies: ["USD"],
  business_hours: { mon_fri: "8:00-17:00" },
  contact: { email: "", phone: "", address: "" },
};

export const DEFAULT_BRANDING_CONFIG = {
  logo_url: "",
  dark_logo_url: "",
  favicon_url: "",
  primary_color: "#4F46E5",
  secondary_color: "#0F172A",
  accent_color: "#10B981",
  typography: { heading: "Inter", body: "Inter" },
  email_branding: {},
  portal_branding: {},
  report_branding: {},
  certificate_branding: {},
  board_report_branding: {},
};

export const DEFAULT_ACADEMIC_CONFIG = {
  school_years: [],
  terms: ["fall", "spring"],
  grade_levels: ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  subjects: [],
  course_types: ["core", "elective", "enrichment"],
  grading_systems: ["standards_based", "letter_grade"],
  attendance_policies: { minimum_pct: 90 },
  graduation_requirements: {},
  promotion_rules: {},
};

export const DEFAULT_ADMISSIONS_CONFIG = {
  inquiry_form_fields: ["name", "email", "phone", "grade"],
  application_required_documents: ["birth_certificate", "immunization"],
  workflow_stages: ["inquiry", "tour", "application", "review", "accepted"],
  acceptance_rules: {},
  interview_process: { enabled: true },
  tour_process: { enabled: true },
};

export const DEFAULT_FINANCE_CONFIG = {
  tuition_models: ["annual", "monthly"],
  billing_frequencies: ["monthly", "quarterly", "annual"],
  late_fee_policy: { pct: 5, grace_days: 10 },
  sibling_discount_pct: 10,
  payment_plans: ["full", "monthly", "quarterly"],
  revenue_categories: ["tuition", "fees", "transportation"],
};

export const DEFAULT_HR_CONFIG = {
  employment_types: ["full_time", "part_time", "contract"],
  teacher_types: ["lead", "assistant", "substitute"],
  leave_policies: { pto_days: 10 },
  certification_rules: { renewal_reminder_days: 90 },
};

export const DEFAULT_INTEGRATIONS_CONFIG = {
  square: { enabled: false },
  quickbooks: { enabled: false },
  google_workspace: { enabled: false },
  microsoft_365: { enabled: false },
  clever: { enabled: false },
  google_meet: { enabled: true },
  webhooks: [] as Array<{ url: string; events: string[] }>,
};

export const DEFAULT_COMMUNICATIONS_CONFIG = {
  email_templates: [],
  sms_templates: [],
  portal_templates: [],
  languages: ["en"],
  notification_rules: [],
  sender_profiles: [],
};

export const DEFAULT_WORKFLOWS_CONFIG = {
  automations: [],
  playbooks: [],
  approvals: [],
  deadlines: [],
  escalations: [],
  mission_control_rules: [],
};

export const SECTION_DEFAULTS: Record<ConfigSectionKey, Record<string, unknown>> = {
  organization: DEFAULT_ORGANIZATION_CONFIG,
  branding: DEFAULT_BRANDING_CONFIG,
  academic: DEFAULT_ACADEMIC_CONFIG,
  admissions: DEFAULT_ADMISSIONS_CONFIG,
  finance: DEFAULT_FINANCE_CONFIG,
  hr: DEFAULT_HR_CONFIG,
  communications: DEFAULT_COMMUNICATIONS_CONFIG,
  workflows: DEFAULT_WORKFLOWS_CONFIG,
  integrations: DEFAULT_INTEGRATIONS_CONFIG,
  security: { password_policy: { min_length: 12 }, mfa_required: false, session_timeout_minutes: 480 },
  automation: { workflow_marketplace_enabled: true },
  compliance: { obligation_sync: true },
  playbooks: { enabled: true },
  mission_control: { auto_sync: true },
  executive: { widgets_enabled: true },
  scheduling: { conflict_detection: true },
  portals: { parent_enabled: true, student_enabled: true },
};
