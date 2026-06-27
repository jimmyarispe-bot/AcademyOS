export type AipPromptCategory =
  | "admissions" | "teacher" | "parent" | "student" | "finance" | "scholarships"
  | "state_funding" | "executive" | "hr" | "scheduling" | "ssis" | "compliance"
  | "work_management" | "communications" | "reports" | "future";

export type AipPromptStatus = "draft" | "pending_review" | "approved" | "published" | "archived" | "rejected";
export type AipApprovalType = "auto_approved" | "human_review" | "executive_review" | "founder_approval";
export type AipJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "retrying";

export interface ContextBuildInput {
  organizationId: string;
  schoolId?: string;
  userId: string;
  module: string;
  permissions: string[];
  scopes?: {
    studentIds?: string[];
    familyIds?: string[];
    financialScope?: boolean;
    executiveScope?: boolean;
  };
}

export interface ContextBuildResult {
  allowed: boolean;
  maskedFields: string[];
  contextPayload: Record<string, unknown>;
  ferpaFiltered: boolean;
  classificationFiltered: boolean;
}

export interface CostSummary {
  dailyCost: number;
  monthlyCost: number;
  organizationCost: number;
  topPrompts: Array<{ promptId: string; cost: number }>;
  moduleBreakdown: Array<{ module: string; cost: number; tokens: number }>;
}

export interface MonitoringSummary {
  queueHealth: { queued: number; running: number; failed: number };
  providerHealth: Array<{ providerKey: string; healthStatus: string }>;
  avgResponseTimeMs: number;
  estimatedDailyCost: number;
  failureCount: number;
}

export const AIP_NAV = [
  { href: "/dashboard/intelligence", label: "Intelligence Hub", exact: true as const },
  { href: "/dashboard/intelligence/providers", label: "Providers" },
  { href: "/dashboard/intelligence/prompts", label: "Prompts" },
  { href: "/dashboard/intelligence/jobs", label: "Jobs" },
  { href: "/dashboard/intelligence/history", label: "History" },
  { href: "/dashboard/intelligence/policies", label: "Policies" },
  { href: "/dashboard/intelligence/testing", label: "Testing Lab" },
  { href: "/dashboard/intelligence/costs", label: "Costs" },
  { href: "/dashboard/intelligence/approvals", label: "Approvals" },
  { href: "/dashboard/intelligence/settings", label: "Settings" },
] as const;

export const PROMPT_CATEGORIES: Array<{ value: AipPromptCategory; label: string }> = [
  { value: "admissions", label: "Admissions" },
  { value: "teacher", label: "Teacher" },
  { value: "parent", label: "Parent" },
  { value: "student", label: "Student" },
  { value: "finance", label: "Finance" },
  { value: "scholarships", label: "Scholarships" },
  { value: "executive", label: "Executive" },
  { value: "hr", label: "HR" },
  { value: "scheduling", label: "Scheduling" },
  { value: "ssis", label: "SSIS" },
  { value: "compliance", label: "Compliance" },
  { value: "work_management", label: "Work Management" },
  { value: "communications", label: "Communications" },
  { value: "reports", label: "Reports" },
  { value: "future", label: "Future" },
];

export const FUTURE_AI_USE_CASES = [
  "lesson_planning",
  "admissions_summaries",
  "scholarship_recommendations",
  "financial_insights",
  "executive_summaries",
  "report_card_narratives",
  "behavior_summaries",
  "risk_identification",
  "parent_communication_drafts",
  "teacher_assistance",
  "compliance_reviews",
  "decision_intelligence_enhancements",
] as const;

export const PROVIDER_CAPABILITIES = [
  "chat", "embeddings", "reasoning", "image_analysis", "document_analysis", "speech",
] as const;
