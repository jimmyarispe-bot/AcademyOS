/** AcademyOS enterprise identity & permission keys (mirrors platform_permissions seed) */

export const PERMISSION_KEYS = [
  "org.view",
  "org.manage",
  "users.view",
  "users.manage",
  "roles.view",
  "roles.manage",
  "security.view",
  "impersonate.users",
  "students.view",
  "students.edit",
  "admissions.view",
  "admissions.accept",
  "admissions.manage",
  "scholarships.view",
  "scholarships.approve",
  "funding.view",
  "funding.verify",
  "funding.export",
  "finance.view",
  "finance.override_tuition",
  "finance.export",
  "hr.view",
  "hr.manage",
  "hr.recruiting",
  "hr.compliance",
  "hr.analytics",
  "employee.self_service",
  "payroll.run",
  "workflows.view",
  "workflows.manage",
  "templates.manage",
  "mission_control.access",
  "executive.dashboard",
  "executive.intelligence",
  "executive.board_reports",
  "executive.strategic",
  "executive.risk_view",
  "finance.executive",
  "finance.forecast",
  "instruction.executive",
  "scheduling.executive",
  "school.configure",
  "directory.view",
  "founder.override",
  "founder.emergency_access",
  "records.unlock",
  "workflows.approve_any",
  "audit.view_all",
  "licensing.manage",
  "global.reporting",
  "compliance.view",
  "compliance.manage",
  "compliance.admin",
  "compliance.reports",
  "work.view",
  "work.manage",
  "work.admin",
  "work.reports",
  "work.executive",
  "fi.view",
  "fi.manage",
  "fi.executive",
  "fi.import",
  "fi.scenarios",
  "edi.view",
  "edi.manage",
  "edi.executive",
  "edi.board",
  "configuration.view",
  "configuration.manage",
  "configuration.admin",
  "configuration.launch",
  "data.view",
  "data.manage",
  "data.import",
  "data.export",
  "data.admin",
  "ai.view",
  "ai.use",
  "ai.manage",
  "ai.providers",
  "ai.prompts",
  "ai.testing",
  "ai.admin",
  "ai.executive",
  "ai.finance",
  "ai.student",
  "ai.teacher",
  "ai.parent",
  "cloud.admin",
  "cloud.support",
  "cloud.operations",
  "cloud.sales",
  "cloud.finance",
  "cloud.engineering",
  "cloud.analytics",
  "certification.view",
  "certification.manage",
  "certification.admin",
  "integration.view",
  "integration.manage",
  "integration.admin",
  "integration.developer",
  "integration.marketplace",
  "integration.operations",
  "integration.security",
  "developer.portal",
  "operations.view",
  "operations.manage",
  "operations.executive",
  "operations.security",
  "operations.support",
  "operations.billing",
  "operations.analytics",
  "operations.partners",
  "network.view",
  "network.manage",
  "network.admin",
  "finance.billing",
  "finance.scholarships",
  "finance.state_funding",
  "finance.payroll",
  "finance.accounting",
  "finance.banking",
  "finance.audit",
  "finance.approve",
  "ferpa.view_iep",
  "ferpa.view_medical",
  "ferpa.view_discipline",
  "ferpa.view_evaluations",
  "portal.parent.access",
  "portal.student.access",
  "approvals.configure",
  "approvals.review",
  "search.global",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const MISSION_CONTROL_MODULES_BY_PERMISSION: Record<string, string[]> = {
  admissions: ["admissions.view", "admissions.manage", "admissions.accept"],
  finance: ["finance.view", "finance.override_tuition"],
  hr: ["hr.view", "hr.manage", "hr.compliance"],
  scholarships: ["scholarships.view", "scholarships.approve"],
  state_funding: ["funding.view", "funding.verify"],
  executive: ["executive.dashboard", "executive.intelligence", "global.reporting"],
  sis: ["students.view", "students.edit"],
  scheduling: ["hr.view"],
};

export interface OrgAssignment {
  id: string;
  school_id: string;
  campus_id: string | null;
  program_id: string | null;
  department_id: string | null;
  all_campuses: boolean;
  all_programs: boolean;
  is_primary: boolean;
  schools?: { name: string } | null;
}

export interface IdentityRole {
  id: string;
  name: string;
  display_name: string | null;
  is_custom: boolean;
}

export interface ImpersonationState {
  sessionId: string;
  actorUserId: string;
  targetUserId: string;
  targetName: string;
  startedAt: string;
}

export interface UserPreferences {
  user_id: string;
  timezone: string;
  language: string;
  theme: "light" | "dark" | "system";
  dashboard_layout: Record<string, unknown>;
  notifications: Record<string, unknown>;
  accessibility: Record<string, unknown>;
  communication: Record<string, unknown>;
  mission_control_widgets: Record<string, unknown>;
}

export interface SecurityEventSummary {
  failedLogins: number;
  permissionChanges: number;
  roleAssignments: number;
  impersonations: number;
  exports: number;
  sensitiveAccess: number;
}

export const DATA_CLASSIFICATIONS = [
  "public", "internal", "confidential", "restricted",
  "medical", "financial", "executive", "special_education",
] as const;

export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export const FINANCIAL_PERMISSION_AREAS = [
  "finance.billing", "finance.scholarships", "finance.state_funding",
  "finance.payroll", "finance.accounting", "finance.banking",
  "finance.audit", "finance.approve",
] as const;

export interface ComplianceDashboardData {
  ferpaAccessCount: number;
  fundingAlerts: number;
  scholarshipPending: number;
  securityEvents: number;
  permissionChanges: number;
  expiringCertifications: number;
  pendingApprovals: number;
}

export interface GlobalSearchResult {
  id: string;
  module: string;
  entityType: string;
  title: string;
  subtitle: string;
  href: string;
  classification: DataClassification;
}

export interface ApprovalRule {
  id: string;
  rule_key: string;
  name: string;
  module: string;
  description: string | null;
  approver_roles: string[];
  threshold_value: number | null;
  threshold_unit: string | null;
  is_active: boolean;
  condition_config?: Record<string, unknown>;
}

export const MFA_METHODS = ["totp", "sms", "email", "passkey"] as const;
export type MfaMethod = (typeof MFA_METHODS)[number];
