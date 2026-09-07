import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getDashboardMetrics } from "@/lib/dashboard/metrics";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";
import { getExecutiveInstructionDashboard } from "@/lib/instruction/executive";
import { getWorkforceAnalytics } from "@/lib/hr/analytics";
import { getMissionControlFeed } from "@/lib/platform/automation/mission-control";
import type { CommandCenterMetrics, ExecutiveInsight } from "@/lib/executive/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/**
 * Legacy Command Center metrics composer.
 * Uses lightweight Mission Control feed counts — does NOT call
 * getMissionControlDashboard (avoids CCM ↔ MC circular dependency).
 *
 * Prefer getExecutiveAggregateMetrics + aggregateToCommandCenterMetrics
 * when aggregate is already loaded for the request.
 */
export async function getCommandCenterMetrics(
  supabase: AuthClient,
  schoolId?: string
): Promise<CommandCenterMetrics> {
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [home, finance, instruction, workforce, mcFeed, enrollmentTrend] =
    await Promise.all([
      getDashboardMetrics(),
      getFinanceExecutiveDashboard(supabase, schoolId),
      getExecutiveInstructionDashboard(supabase, schoolId),
      getWorkforceAnalytics(supabase, schoolId),
      getMissionControlFeed(supabase, { schoolId, limit: 50 }),
      computeEnrollmentTrend(supabase, schoolId),
    ]);

  let complianceAlerts = 0;
  const { count: complianceCount } = await supabase
    .from("compliance_obligations")
    .select("id", { count: "exact", head: true })
    .or(
      `status.eq.overdue,and(status.eq.pending,due_date.lt.${new Date().toISOString().split("T")[0]})`
    );
  complianceAlerts = complianceCount ?? 0;

  // `payments` has no `payment_date` column -- it is `paid_at` -- and PostgREST
  // answers a filter on a column that does not exist with an error rather than
  // rows. The old code discarded that error and reduced null to 0, so the
  // Command Center has reported cash flow of exactly 0 since it was written.
  // See the note in financial-intelligence/school-financials.ts; same bug, and
  // this was the second copy of it.
  let paymentsQuery = supabase
    .from("payments")
    .select("amount, invoices!inner(family_billing_accounts!inner(school_id))")
    .eq("payment_status", "completed")
    .gte("paid_at", `${yearStart}T00:00:00Z`);

  if (schoolId) {
    paymentsQuery = paymentsQuery.eq("invoices.family_billing_accounts.school_id", schoolId);
  }

  const { data: paymentsYtd, error: paymentsError } = await paymentsQuery;
  if (paymentsError) {
    console.error("[getCommandCenterMetrics] cash flow query failed", {
      schoolId: schoolId ?? "all",
      error: paymentsError.message,
    });
  }
  const cashFlow = (paymentsYtd ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const interventionEffectiveness =
    instruction.interventionEffectiveness.sampleSize > 0
      ? Math.round(
          (instruction.interventionEffectiveness.strong /
            instruction.interventionEffectiveness.sampleSize) *
            100
        )
      : null;

  const missionControlOpen = mcFeed.length;
  const missionControlCritical = mcFeed.filter(
    (i) => (i.severity ?? "").toLowerCase() === "critical"
  ).length;

  return {
    enrollment: home.enrollment,
    enrollmentTrendPct: enrollmentTrend,
    admissionsPipeline: home.admissionsPipeline,
    revenue: finance.totalCollected,
    cashFlow,
    accountsReceivable: finance.outstanding,
    scholarships: finance.scholarshipsAwarded,
    stateFunding: finance.stateFundingApplied,
    avgSuccessScore: instruction.avgGoalProgress ?? null,
    attendanceRate: await fetchAttendanceRate(supabase, schoolId),
    academicGrowthPct: instruction.avgGoalProgress ?? null,
    interventionEffectiveness,
    staffingLevels: workforce.staffingLevels,
    payrollYtd: workforce.payrollCostsYtd,
    complianceAlerts,
    missionControlOpen,
    missionControlCritical,
  };
}

async function fetchAttendanceRate(supabase: AuthClient, schoolId?: string) {
  let query = supabase
    .from("rpt_student_outcomes")
    .select("attendance_present, attendance_total");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  const present = (data ?? []).reduce((s, r) => s + Number(r.attendance_present ?? 0), 0);
  const total = (data ?? []).reduce((s, r) => s + Number(r.attendance_total ?? 0), 0);
  return total ? Math.round((present / total) * 100) : null;
}

async function computeEnrollmentTrend(supabase: AuthClient, schoolId?: string) {
  const now = new Date();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString()
    .split("T")[0];

  let currentQuery = supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  let priorQuery = supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .lte("created_at", `${lastMonthEnd}T23:59:59`);

  if (schoolId) {
    currentQuery = currentQuery.eq("school_id", schoolId);
    priorQuery = priorQuery.eq("school_id", schoolId);
  }

  const [{ count: current }, { count: prior }] = await Promise.all([
    currentQuery,
    priorQuery,
  ]);
  if (!prior || prior === 0) return null;
  return Math.round(((Number(current ?? 0) - prior) / prior) * 100);
}

export async function getExecutiveInsights(
  supabase: AuthClient,
  schoolId?: string,
  limit = 12
): Promise<ExecutiveInsight[]> {
  let query = supabase
    .from("executive_insights")
    .select(
      "id, title, body, severity, insight_type, recommended_action, href, metric_key, metric_value"
    )
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (schoolId) query = query.or(`school_id.eq.${schoolId},school_id.is.null`);

  const { data } = await query;
  return (data ?? []) as ExecutiveInsight[];
}

export async function getDashboardLayout(supabase: AuthClient, userId: string) {
  const { data } = await supabase
    .from("executive_dashboard_layouts")
    .select("widgets")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  return data?.widgets ?? null;
}
