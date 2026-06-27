export type SyncMode = "realtime" | "scheduled" | "manual";
export type SyncDirection = "import" | "export" | "bidirectional";
export type ConflictResolution = "local_wins" | "remote_wins" | "merged" | "pending";
export type CustomConnectorProtocol = "rest" | "soap" | "graphql" | "csv" | "xml" | "json" | "ftp" | "sftp" | "webhook" | "sql" | "odata";
export type CertificationStatus = "certified" | "verified" | "preview" | "beta" | "deprecated" | "unsupported";
export type WorkflowStatus = "draft" | "testing" | "published" | "archived";

export const IHUB_NAV = [
  { href: "/dashboard/integrations/dashboard", label: "Executive", exact: true as const },
  { href: "/dashboard/integrations/command-center", label: "Command Center" },
  { href: "/dashboard/integrations/automation", label: "Automation Studio" },
  { href: "/dashboard/integrations/connectors", label: "Connectors" },
  { href: "/dashboard/integrations/builder", label: "Connector Builder" },
  { href: "/dashboard/integrations/certification", label: "Certification" },
  { href: "/dashboard/integrations/events", label: "Event Bus" },
  { href: "/dashboard/integrations/webhooks", label: "Webhooks" },
  { href: "/dashboard/integrations/api", label: "API" },
  { href: "/dashboard/integrations/sync", label: "Sync" },
  { href: "/dashboard/integrations/mappings", label: "Mappings" },
  { href: "/dashboard/integrations/marketplace", label: "Marketplace" },
  { href: "/dashboard/integrations/provisioning", label: "Provisioning" },
  { href: "/dashboard/integrations/metering", label: "Usage Metering" },
  { href: "/dashboard/integrations/devops", label: "DevOps" },
  { href: "/dashboard/integrations/disaster-recovery", label: "Disaster Recovery" },
  { href: "/dashboard/integrations/developer", label: "Developer" },
  { href: "/dashboard/integrations/security", label: "Security" },
  { href: "/dashboard/integrations/logs", label: "Logs" },
  { href: "/dashboard/integrations/testing", label: "Testing Lab" },
] as const;

export const EVENT_BUS_MODULES = [
  "admissions", "enrollment", "scheduling", "teacher_workspace", "ssis", "finance", "hr",
  "compliance", "cloud_platform", "executive_intelligence", "financial_intelligence", "work_management",
] as const;

export const WEBHOOK_EVENT_TYPES = [
  { key: "student.created", label: "Student Created", module: "ssis", version: "1.0" },
  { key: "student.accepted", label: "Student Accepted", module: "admissions", version: "1.0" },
  { key: "student.enrolled", label: "Student Enrolled", module: "enrollment", version: "1.0" },
  { key: "enrollment.completed", label: "Enrollment Completed", module: "admissions", version: "1.0" },
  { key: "attendance.recorded", label: "Attendance Recorded", module: "ssis", version: "1.0" },
  { key: "attendance.submitted", label: "Attendance Submitted", module: "ssis", version: "1.0" },
  { key: "assessment.completed", label: "Assessment Completed", module: "ssis", version: "1.0" },
  { key: "scholarship.approved", label: "Scholarship Approved", module: "scholarships", version: "1.0" },
  { key: "funding.verified", label: "Funding Verified", module: "state_funding", version: "1.0" },
  { key: "invoice.generated", label: "Invoice Generated", module: "finance", version: "1.0" },
  { key: "payment.received", label: "Payment Received", module: "finance", version: "1.0" },
  { key: "payroll.completed", label: "Payroll Completed", module: "hr", version: "1.0" },
  { key: "employee.hired", label: "Employee Hired", module: "hr", version: "1.0" },
  { key: "class.created", label: "Class Created", module: "scheduling", version: "1.0" },
  { key: "schedule.changed", label: "Schedule Changed", module: "scheduling", version: "1.0" },
  { key: "workflow.completed", label: "Workflow Completed", module: "automation", version: "1.0" },
  { key: "document.signed", label: "Document Signed", module: "compliance", version: "1.0" },
  { key: "task.completed", label: "Task Completed", module: "work_management", version: "1.0" },
  { key: "mission_control.alert", label: "Mission Control Alert", module: "executive", version: "1.0" },
] as const;

export const API_VERSIONS = ["v1", "v2-beta"] as const;

export const CONNECTOR_CATEGORIES = [
  "general", "finance", "productivity", "scheduling", "lms", "sis", "assessment",
  "communication", "marketing", "crm", "documents", "storage", "healthcare", "state_funding",
] as const;

export const HEALTHCARE_CONNECTORS = [
  "medicaid_billing", "aba_billing", "therapy_billing", "ehr", "insurance_eligibility",
  "clinical_documentation", "therapy_scheduling", "aba_platform",
] as const;

export const STATE_FUNDING_CONNECTORS = [
  "esa_provider", "voucher_provider", "scholarship_org", "grant_provider", "payment_portal",
] as const;

export const STATE_FUNDING_TRACKING = [
  "award_updates", "balances", "renewals", "payments", "verification", "award_verification",
] as const;

export const CUSTOM_CONNECTOR_PROTOCOLS: CustomConnectorProtocol[] = [
  "rest", "soap", "graphql", "csv", "xml", "json", "ftp", "sftp", "webhook", "sql", "odata",
];

export const CONNECTOR_AUTH_TYPES = ["oauth", "oauth2", "jwt", "bearer", "api_key", "basic", "certificate"] as const;

export const WORKFLOW_STEP_TYPES = [
  "trigger", "condition", "branch", "loop", "variable", "transform", "approval",
  "delay", "retry", "error_handler", "timeout", "parallel", "action",
] as const;

export const MARKETPLACE_PACK_TYPES = [
  "application", "dashboard", "widget", "workflow_pack", "compliance_pack",
  "financial_pack", "reporting_pack", "connector", "automation_template", "state_funding_module",
] as const;

export const METERING_DIMENSIONS = [
  "users", "students", "families", "employees", "schools", "campuses",
  "storage", "bandwidth", "api_calls", "webhook_calls", "connector_executions",
  "sync_jobs", "workflow_runs", "automation_runs", "marketplace_modules",
] as const;

export const IHUB_AI_CAPABILITIES = [
  "connector_recommendations",
  "workflow_recommendations",
  "field_mapping_suggestions",
  "error_resolution_suggestions",
  "duplicate_connector_detection",
  "capacity_recommendations",
] as const;

export const SDK_LANGUAGES = [
  { language: "typescript", label: "TypeScript", package: "@academyos/sdk" },
  { language: "javascript", label: "JavaScript", package: "@academyos/sdk-js" },
  { language: "python", label: "Python", package: "academyos-sdk" },
  { language: "java", label: "Java", package: "com.academyos.sdk" },
  { language: "dotnet", label: ".NET", package: "AcademyOS.Sdk" },
  { language: "php", label: "PHP", package: "academyos/sdk" },
  { language: "go", label: "Go", package: "github.com/academyos/sdk-go" },
] as const;

export const TESTING_LAB_SCENARIOS = [
  "api_calls", "webhook_delivery", "connector_health", "authentication",
  "sync", "retry", "load", "error_handling",
] as const;

export interface IntegrationHubSummary {
  connectorCount: number;
  activeConnectors: number;
  webhookCount: number;
  apiKeyCount: number;
  eventCount24h: number;
  syncFailureCount: number;
  monitoring: {
    connectorHealthPct: number;
    apiHealthPct: number;
    webhookFailures: number;
    syncLatencyMs: number;
    webhookSuccessRate: number;
    queueStatus: string;
  };
}

export interface ExecutiveIntegrationSnapshot {
  connectedSystems: number;
  connectorHealthPct: number;
  failedSyncs: number;
  dailyTransactions: number;
  webhookSuccessRate: number;
  apiUsageCount: number;
  externalDataVolumeMb: number;
  marketplaceRevenue: number;
}
