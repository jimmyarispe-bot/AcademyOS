import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ExecutiveFinancialDashboard } from "@/lib/financial-intelligence/types";
import { computeClassProfitability, computeProgramProfitability } from "@/lib/financial-intelligence/profitability";
import { computeBreakEvenAnalysis, summarizeBreakEven } from "@/lib/financial-intelligence/break-even";
import { computeSchoolFinancials } from "@/lib/financial-intelligence/school-financials";
import { getFinancialForecastSummary } from "@/lib/financial-intelligence/forecasting";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getExecutiveFinancialDashboard(
  supabase: AuthClient,
  schoolId: string
): Promise<ExecutiveFinancialDashboard> {
  const [school, programs, classes, forecast, finance, alertsRes] = await Promise.all([
    computeSchoolFinancials(supabase, schoolId),
    computeProgramProfitability(supabase, schoolId),
    computeClassProfitability(supabase, schoolId, "monthly"),
    getFinancialForecastSummary(supabase, schoolId),
    getFinanceExecutiveDashboard(supabase, schoolId),
    supabase
      .from("fi_financial_alerts")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_resolved", false),
  ]);

  await computeBreakEvenAnalysis(supabase, schoolId);

  const sortedPrograms = [...programs].sort((a, b) => b.netMargin - a.netMargin);
  const beSummary = summarizeBreakEven(classes);

  return {
    ebitda: school.ebitda,
    cashPosition: school.cashFlow,
    revenueTrend: finance.collectionRate,
    marginTrend: school.operatingMargin,
    operatingMargin: school.operatingMargin,
    contributionMargin: school.netMargin,
    topPrograms: sortedPrograms.slice(0, 5),
    bottomPrograms: [...sortedPrograms].reverse().slice(0, 5),
    classesBelowBreakeven: beSummary.belowBreakEven,
    classesAboveTarget: beSummary.aboveTargetMargin,
    financialRisks: alertsRes.count ?? 0,
    forecastRevenue: forecast?.forecastTuition ?? null,
    forecastPayroll: forecast?.forecastPayroll ?? null,
  };
}

export async function getFinancialAlerts(supabase: AuthClient, schoolId?: string, limit = 20) {
  let query = supabase
    .from("fi_financial_alerts")
    .select("*")
    .eq("is_resolved", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}
