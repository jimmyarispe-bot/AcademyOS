import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getCommandCenterMetrics } from "@/lib/executive/command-center";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";
import { getWorkforceAnalytics } from "@/lib/hr/analytics";
import { getExecutiveAdmissionsMetrics } from "@/lib/admissions/executive-metrics";
import { getExecutiveInstructionDashboard } from "@/lib/instruction/executive";
import type { KpiRow } from "@/lib/executive/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getKpiCenter(supabase: AuthClient, schoolId?: string): Promise<KpiRow[]> {
  const [definitions, metrics, finance, workforce, instruction, admissions] = await Promise.all([
    supabase.from("executive_kpi_definitions").select("*").eq("is_active", true).order("sort_order"),
    getCommandCenterMetrics(supabase, schoolId),
    getFinanceExecutiveDashboard(supabase, schoolId),
    getWorkforceAnalytics(supabase, schoolId),
    getExecutiveInstructionDashboard(supabase, schoolId),
    getExecutiveAdmissionsMetrics(),
  ]);

  const computed: Record<string, number | null> = {
    enrollment_growth: metrics.enrollmentTrendPct,
    student_retention: null,
    attendance_rate: metrics.attendanceRate,
    avg_success_score: metrics.avgSuccessScore,
    reading_growth: instruction.avgGoalProgress ?? null,
    parent_engagement: null,
    staff_retention: workforce.turnoverRate ? 100 - workforce.turnoverRate : null,
    collection_rate: finance.collectionRate,
    operating_margin: finance.tuitionYield,
    grant_utilization: null,
  };

  return (definitions.data ?? []).map((def) => {
    const actual = computed[def.kpi_key] ?? null;
    const target = def.target_value != null ? Number(def.target_value) : null;
    const status = scoreKpiStatus(actual, target, def.warning_threshold, def.critical_threshold, def.higher_is_better);
    return {
      kpi_key: def.kpi_key,
      display_name: def.display_name,
      category: def.category,
      unit: def.unit,
      actual_value: actual,
      target_value: target,
      prior_value: null,
      trend_pct: def.kpi_key === "enrollment_growth" ? metrics.enrollmentTrendPct : null,
      status,
    };
  });
}

function scoreKpiStatus(
  actual: number | null,
  target: number | null,
  warning: number | null,
  critical: number | null,
  higherIsBetter: boolean
): KpiRow["status"] {
  if (actual == null || target == null) return "unknown";
  const warn = warning != null ? Number(warning) : target * 0.9;
  const crit = critical != null ? Number(critical) : target * 0.8;
  if (higherIsBetter) {
    if (actual >= target) return "on_track";
    if (actual >= warn) return "warning";
    if (actual >= crit) return "warning";
    return "critical";
  }
  if (actual <= target) return "on_track";
  if (actual <= warn) return "warning";
  return "critical";
}

export async function getKpiHistory(
  supabase: AuthClient,
  kpiKey: string,
  schoolId?: string,
  limit = 12
) {
  let query = supabase
    .from("executive_kpi_snapshots")
    .select("snapshot_date, actual_value, target_value")
    .eq("kpi_key", kpiKey)
    .order("snapshot_date", { ascending: false })
    .limit(limit);

  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}
