import type { createAuthClient } from "@/lib/supabase/server-auth";
import type {
  ComplianceObligation,
  DeadlineBucket,
  ExecutiveDeadlineAnalytics,
  ObligationAssigneeType,
} from "@/lib/compliance/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const OBLIGATION_SELECT = `
  id, school_id, title, description, priority, risk_level, status, due_date, completion_date,
  assignee_type, student_id, family_id, employee_id, guardian_user_id,
  action_type, action_href, parent_can_complete, subject_domain,
  source_module, source_entity_type, source_entity_id,
  compliance_categories(name, domain, category_key)
`;

const today = () => new Date().toISOString().split("T")[0];
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().split("T")[0];
const weekEnd = () => new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
const in30 = () => new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

function bucketObligations(rows: ComplianceObligation[]): DeadlineBucket {
  const t = today();
  const tm = tomorrow();
  const we = weekEnd();
  const d30 = in30();

  const active = rows.filter((r) => !["completed", "archived", "cancelled", "waived"].includes(r.status));
  const completed = rows.filter((r) => r.status === "completed");

  return {
    today: active.filter((r) => r.due_date === t),
    thisWeek: active.filter((r) => r.due_date > t && r.due_date <= we),
    next30Days: active.filter((r) => r.due_date > we && r.due_date <= d30),
    overdue: active.filter((r) => r.due_date < t || r.status === "overdue"),
    upcoming: active.filter((r) => r.due_date >= tm && r.due_date <= d30),
    completed,
  };
}

function studentBucket(rows: ComplianceObligation[]): DeadlineBucket & { dueTomorrow: ComplianceObligation[] } {
  const t = today();
  const tm = tomorrow();
  const base = bucketObligations(rows);
  const active = rows.filter((r) => !["completed", "archived", "cancelled", "waived"].includes(r.status));

  return {
    ...base,
    dueTomorrow: active.filter((r) => r.due_date === tm),
  };
}

async function fetchObligations(
  supabase: AuthClient,
  filters: {
    assigneeType: ObligationAssigneeType;
    guardianUserId?: string;
    studentIds?: string[];
    studentId?: string;
    employeeId?: string;
    schoolId?: string;
    includeCompleted?: boolean;
  }
) {
  let query = supabase
    .from("compliance_obligations")
    .select(OBLIGATION_SELECT)
    .eq("assignee_type", filters.assigneeType)
    .order("due_date", { ascending: true });

  if (!filters.includeCompleted) {
    query = query.not("status", "in", '("completed","archived","cancelled","waived")');
  }

  if (filters.guardianUserId && filters.studentIds?.length) {
    query = query.or(
      `guardian_user_id.eq.${filters.guardianUserId},student_id.in.(${filters.studentIds.join(",")})`
    );
  } else if (filters.guardianUserId) {
    query = query.eq("guardian_user_id", filters.guardianUserId);
  } else if (filters.studentId) {
    query = query.eq("student_id", filters.studentId);
  } else if (filters.studentIds?.length) {
    query = query.in("student_id", filters.studentIds);
  }

  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters.schoolId) query = query.eq("school_id", filters.schoolId);

  const { data } = await query.limit(200);
  return (data ?? []) as unknown as ComplianceObligation[];
}

export async function getParentDeadlines(
  supabase: AuthClient,
  userId: string,
  studentIds: string[],
  filterStudentId?: string | null
) {
  const ids = filterStudentId ? [filterStudentId] : studentIds;
  const rows = await fetchObligations(supabase, {
    assigneeType: "parent",
    guardianUserId: userId,
    studentIds: ids,
  });
  const filtered = filterStudentId ? rows.filter((r) => r.student_id === filterStudentId) : rows;
  return bucketObligations(filtered);
}

export async function getStudentDeadlines(
  supabase: AuthClient,
  studentId: string,
  filters?: { subjectDomain?: string; priority?: string }
) {
  let rows = await fetchObligations(supabase, {
    assigneeType: "student",
    studentId,
    includeCompleted: true,
  });

  if (filters?.subjectDomain) {
    rows = rows.filter((r) => r.subject_domain === filters.subjectDomain);
  }
  if (filters?.priority) {
    rows = rows.filter((r) => r.priority === filters.priority);
  }

  return studentBucket(rows);
}

export async function getTeacherDocumentationDeadlines(supabase: AuthClient, employeeId: string) {
  const rows = await fetchObligations(supabase, {
    assigneeType: "teacher",
    employeeId,
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.compliance_categories?.category_key ?? "documentation",
    severity: r.risk_level === "critical" || r.status === "overdue" ? "high" : r.priority === "high" ? "high" : "medium",
    title: r.title,
    href: r.action_href ?? `/dashboard/compliance?view=obligations`,
    dueDate: r.due_date,
    categoryKey: r.compliance_categories?.category_key,
  }));
}

function completionRate(rows: { status: string }[]) {
  if (!rows.length) return 100;
  const completed = rows.filter((r) => r.status === "completed").length;
  return Math.round((completed / rows.length) * 100);
}

export async function getExecutiveDeadlineAnalytics(
  supabase: AuthClient,
  schoolId?: string
): Promise<ExecutiveDeadlineAnalytics> {
  const t = today();
  let query = supabase
    .from("compliance_obligations")
    .select("status, assignee_type, due_date, school_id")
    .not("status", "in", '("archived","cancelled","waived")');

  if (schoolId) query = query.eq("school_id", schoolId);

  const { data: rows } = await query;
  const list = rows ?? [];

  const parentRows = list.filter((r) => r.assignee_type === "parent");
  const studentRows = list.filter((r) => r.assignee_type === "student");
  const teacherRows = list.filter((r) => r.assignee_type === "teacher");
  const staffRows = list.filter((r) => ["staff", "executive"].includes(r.assignee_type ?? "staff"));

  const isOverdue = (r: { due_date: string; status: string }) =>
    r.status === "overdue" || (r.status === "pending" && r.due_date < t);

  const schoolCompleted = list.filter((r) => r.status === "completed").length;
  const schoolTotal = list.length;

  return {
    parentCompletionRate: completionRate(parentRows),
    studentAssignmentCompletion: completionRate(studentRows),
    teacherDocumentationCompliance: completionRate(teacherRows),
    schoolCompliance: schoolTotal ? Math.round((schoolCompleted / schoolTotal) * 100) : 100,
    familyOverdue: parentRows.filter(isOverdue).length,
    studentOverdue: studentRows.filter(isOverdue).length,
    staffOverdue: staffRows.filter(isOverdue).length,
  };
}

export function mapObligationsToPortalTasks(obligations: ComplianceObligation[]) {
  return obligations.map((o) => ({
    id: o.id,
    title: o.title,
    dueDate: o.due_date,
    category: o.compliance_categories?.category_key ?? "deadline",
    studentId: o.student_id ?? undefined,
    href: o.action_href ?? undefined,
    actionType: o.action_type ?? undefined,
    parentCanComplete: o.parent_can_complete,
    status: o.status,
    priority: o.priority,
  }));
}
