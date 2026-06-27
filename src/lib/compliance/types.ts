export type ObligationStatus =
  | "draft" | "pending" | "in_review" | "approved" | "completed"
  | "overdue" | "waived" | "cancelled" | "archived";

export type ObligationFrequency =
  | "one_time" | "daily" | "weekly" | "monthly" | "quarterly"
  | "semiannual" | "annual" | "every_x_days" | "custom_rrule";

export type ComplianceDomain =
  | "governance" | "accreditation" | "licensing" | "insurance" | "hr"
  | "finance" | "facilities" | "technology" | "student_services" | "general";

export type ObligationAssigneeType = "parent" | "student" | "teacher" | "staff" | "executive";

export type ObligationActionType = "pay" | "upload" | "sign" | "complete" | "review" | "submit";

export interface ComplianceObligation {
  id: string;
  school_id: string | null;
  campus_id: string | null;
  department: string | null;
  program: string | null;
  category_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  risk_level: string;
  status: ObligationStatus;
  frequency: ObligationFrequency;
  frequency_interval: number | null;
  due_date: string;
  completion_date: string | null;
  owner_user_id: string | null;
  backup_owner_user_id: string | null;
  reviewer_user_id: string | null;
  approver_user_id: string | null;
  notes: string | null;
  source_module: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  mission_control_item_id: string | null;
  assignee_type?: ObligationAssigneeType;
  student_id?: string | null;
  family_id?: string | null;
  employee_id?: string | null;
  guardian_user_id?: string | null;
  action_type?: ObligationActionType | null;
  action_href?: string | null;
  parent_can_complete?: boolean;
  subject_domain?: string | null;
  compliance_categories?: { name: string; domain: string; category_key: string } | null;
  schools?: { name: string } | null;
}

export interface DeadlineBucket {
  today: ComplianceObligation[];
  thisWeek: ComplianceObligation[];
  next30Days: ComplianceObligation[];
  overdue: ComplianceObligation[];
  upcoming?: ComplianceObligation[];
  completed?: ComplianceObligation[];
  dueTomorrow?: ComplianceObligation[];
}

export interface ExecutiveDeadlineAnalytics {
  parentCompletionRate: number;
  studentAssignmentCompletion: number;
  teacherDocumentationCompliance: number;
  schoolCompliance: number;
  familyOverdue: number;
  studentOverdue: number;
  staffOverdue: number;
}

export interface ComplianceDashboardStats {
  upcoming: number;
  overdue: number;
  completed: number;
  compliancePct: number;
  bySchool: Record<string, number>;
  byCategory: Record<string, number>;
  byOwner: Record<string, number>;
  criticalCount: number;
}

export interface ComplianceDomainScore {
  domain: string;
  score_pct: number;
  status_indicator: "green" | "yellow" | "red";
  total_obligations: number;
  completed_obligations: number;
  overdue_obligations: number;
}

export interface RegisterObligationInput {
  schoolId?: string | null;
  campusId?: string | null;
  department?: string | null;
  program?: string | null;
  categoryKey: string;
  title: string;
  description?: string | null;
  priority?: string;
  riskLevel?: string;
  frequency?: ObligationFrequency;
  frequencyInterval?: number | null;
  rrule?: string | null;
  dueDate: string;
  ownerUserId?: string | null;
  backupOwnerUserId?: string | null;
  reviewerUserId?: string | null;
  approverUserId?: string | null;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  assigneeType?: ObligationAssigneeType;
  studentId?: string | null;
  familyId?: string | null;
  employeeId?: string | null;
  guardianUserId?: string | null;
  actionType?: ObligationActionType | null;
  actionHref?: string | null;
  parentCanComplete?: boolean;
  subjectDomain?: string | null;
}

export const COMPLIANCE_TABS = [
  { href: "/dashboard/compliance?view=dashboard", label: "Dashboard", value: "dashboard" },
  { href: "/dashboard/compliance?view=upcoming", label: "Upcoming", value: "upcoming" },
  { href: "/dashboard/compliance?view=overdue", label: "Overdue", value: "overdue" },
  { href: "/dashboard/compliance?view=calendar", label: "Calendar", value: "calendar" },
  { href: "/dashboard/compliance?view=categories", label: "Categories", value: "categories" },
  { href: "/dashboard/compliance?view=obligations", label: "Obligations", value: "obligations" },
  { href: "/dashboard/compliance?view=documents", label: "Documents", value: "documents" },
  { href: "/dashboard/compliance?view=automation", label: "Automation", value: "automation" },
  { href: "/dashboard/compliance?view=reports", label: "Reports", value: "reports" },
  { href: "/dashboard/compliance?view=administration", label: "Administration", value: "administration" },
] as const;
