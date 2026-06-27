import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ComplianceDashboardStats, ComplianceDomainScore, ComplianceObligation } from "@/lib/compliance/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const today = () => new Date().toISOString().split("T")[0];
const in30Days = () => new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

export async function getObligations(
  supabase: AuthClient,
  filters?: {
    schoolId?: string;
    status?: string[];
    overdue?: boolean;
    upcoming?: boolean;
    limit?: number;
  }
): Promise<ComplianceObligation[]> {
  let query = supabase
    .from("compliance_obligations")
    .select("*, compliance_categories(name, domain, category_key), schools(name)")
    .not("status", "in", '("archived","cancelled","waived")')
    .order("due_date");

  if (filters?.schoolId) query = query.eq("school_id", filters.schoolId);
  if (filters?.status?.length) query = query.in("status", filters.status);
  if (filters?.overdue) {
    query = query.or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today()})`);
  }
  if (filters?.upcoming) {
    query = query
      .in("status", ["pending", "in_review", "approved"])
      .gte("due_date", today())
      .lte("due_date", in30Days());
  }
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) {
    console.error("[compliance] getObligations:", error.message);
    return [];
  }
  return (data ?? []) as ComplianceObligation[];
}

export async function getComplianceDashboardStats(
  supabase: AuthClient,
  schoolId?: string
): Promise<ComplianceDashboardStats> {
  let query = supabase
    .from("compliance_obligations")
    .select("id, status, due_date, school_id, owner_user_id, risk_level, compliance_categories(name), schools(name)")
    .not("status", "in", '("archived","cancelled","waived")');

  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  const rows = data ?? [];
  const t = today();

  let upcoming = 0;
  let overdue = 0;
  let completed = 0;
  let criticalCount = 0;
  const bySchool: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byOwner: Record<string, number> = {};

  for (const row of rows) {
    const cat = row.compliance_categories as { name?: string } | null;
    const school = row.schools as { name?: string } | null;
    const catName = cat?.name ?? "Uncategorized";
    const schoolName = school?.name ?? "Network";
    byCategory[catName] = (byCategory[catName] ?? 0) + 1;
    bySchool[schoolName] = (bySchool[schoolName] ?? 0) + 1;
    if (row.owner_user_id) byOwner[row.owner_user_id] = (byOwner[row.owner_user_id] ?? 0) + 1;
    if (row.risk_level === "critical") criticalCount++;

    if (row.status === "completed") completed++;
    else if (row.status === "overdue" || (row.status === "pending" && row.due_date < t)) overdue++;
    else if (row.due_date >= t && row.due_date <= in30Days()) upcoming++;
  }

  const total = rows.length;
  const compliancePct = total ? Math.round((completed / total) * 100) : 100;

  return { upcoming, overdue, completed, compliancePct, bySchool, byCategory, byOwner, criticalCount };
}

export async function getCategories(supabase: AuthClient) {
  const { data } = await supabase
    .from("compliance_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function getReminderSchedules(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("compliance_reminder_schedules").select("*").eq("is_active", true);
  if (schoolId) query = query.or(`school_id.eq.${schoolId},school_id.is.null`);
  const { data } = await query;
  return data ?? [];
}

export async function getEscalationRules(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("compliance_escalation_rules").select("*").eq("is_active", true).order("sort_order");
  if (schoolId) query = query.or(`school_id.eq.${schoolId},school_id.is.null`);
  const { data } = await query;
  return data ?? [];
}

export async function getDomainScores(
  supabase: AuthClient,
  schoolId?: string
): Promise<ComplianceDomainScore[]> {
  let query = supabase
    .from("compliance_obligations")
    .select("status, due_date, school_id, compliance_categories(domain)")
    .not("status", "in", '("archived","cancelled","waived")');

  if (schoolId) query = query.eq("school_id", schoolId);
  const { data: obligations } = await query;

  const t = today();
  const byDomain: Record<string, { total: number; completed: number; overdue: number }> = {};
  const domains = ["governance", "accreditation", "licensing", "insurance", "hr", "finance", "facilities", "technology", "student_services", "general"];

  for (const d of domains) byDomain[d] = { total: 0, completed: 0, overdue: 0 };

  for (const row of obligations ?? []) {
    const cat = row.compliance_categories as { domain?: string } | null;
    const domain = cat?.domain ?? "general";
    if (!byDomain[domain]) byDomain[domain] = { total: 0, completed: 0, overdue: 0 };
    byDomain[domain].total++;
    if (row.status === "completed") byDomain[domain].completed++;
    if (row.status === "overdue" || (row.status === "pending" && row.due_date < t)) byDomain[domain].overdue++;
  }

  return Object.entries(byDomain).map(([domain, stats]) => {
    const score_pct = stats.total ? Math.round((stats.completed / stats.total) * 100) : 100;
    const status_indicator = score_pct >= 90 && stats.overdue === 0 ? "green" : score_pct >= 70 ? "yellow" : "red";
    return {
      domain,
      score_pct,
      status_indicator: status_indicator as "green" | "yellow" | "red",
      total_obligations: stats.total,
      completed_obligations: stats.completed,
      overdue_obligations: stats.overdue,
    };
  });
}

export async function getObligationDocuments(supabase: AuthClient, obligationId?: string) {
  let query = supabase
    .from("compliance_obligation_documents")
    .select("*, compliance_obligations(title, due_date, school_id)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (obligationId) query = query.eq("obligation_id", obligationId);
  const { data } = await query;
  return data ?? [];
}

export async function getAuditLog(supabase: AuthClient, obligationId: string) {
  const { data } = await supabase
    .from("compliance_audit_log")
    .select("*")
    .eq("obligation_id", obligationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
