import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getDashboardMetrics } from "@/lib/dashboard/metrics";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";
import { getExecutiveInstructionDashboard } from "@/lib/instruction/executive";
import { getWorkforceAnalytics } from "@/lib/hr/analytics";
import { getExecutiveAdmissionsMetrics } from "@/lib/admissions/executive-metrics";
import { getMissionControlDashboard } from "@/lib/platform/automation/queries";
import type { CommandCenterMetrics, ExecutiveInsight } from "@/lib/executive/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getCommandCenterMetrics(
  supabase: AuthClient,
  schoolId?: string
): Promise<CommandCenterMetrics> {
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [home, finance, instruction, workforce, missionControl, enrollmentTrend] =
    await Promise.all([
      getDashboardMetrics(),
      getFinanceExecutiveDashboard(supabase, schoolId),
      getExecutiveInstructionDashboard(supabase, schoolId),
      getWorkforceAnalytics(supabase, schoolId),
      getMissionControlDashboard(),
      computeEnrollmentTrend(supabase, schoolId),
    ]);

  let complianceAlerts = 0;
  const { count: complianceCount } = await supabase
    .from("compliance_obligations")
    .select("id", { count: "exact", head: true })
    .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${new Date().toISOString().split("T")[0]})`);
  complianceAlerts = complianceCount ?? 0;

  const { data: paymentsYtd } = await supabase
    .from("payments")
    .select("amount, payment_date")
    .gte("payment_date", yearStart);
  const cashFlow = (paymentsYtd ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const interventionEffectiveness =
    instruction.interventionEffectiveness.sampleSize > 0
      ? Math.round(
          (instruction.interventionEffectiveness.strong / instruction.interventionEffectiveness.sampleSize) * 100
        )
      : null;

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
    missionControlOpen: missionControl.summary?.openItems ?? 0,
    missionControlCritical: missionControl.summary?.overdueTasks ?? 0,
  };
}

async function fetchAttendanceRate(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("rpt_student_outcomes").select("attendance_present, attendance_total");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  const present = (data ?? []).reduce((s, r) => s + Number(r.attendance_present ?? 0), 0);
  const total = (data ?? []).reduce((s, r) => s + Number(r.attendance_total ?? 0), 0);
  return total ? Math.round((present / total) * 100) : null;
}

async function computeEnrollmentTrend(supabase: AuthClient, schoolId?: string) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

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

  const [{ count: current }, { count: prior }] = await Promise.all([currentQuery, priorQuery]);
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
    .select("id, title, body, severity, insight_type, recommended_action, href, metric_key, metric_value")
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
