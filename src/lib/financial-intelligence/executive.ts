import type { createAuthClient } from "@/lib/supabase/server-auth";
import { FI_ALERT_COLS } from "@/lib/finance/family-financial-projections";
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

  // `classes` is already in hand from the fan-out above. Without passing it,
  // this recomputed the most expensive query in the file a second time -- which
  // is what made the four per-school KPI snapshots exceed 12 seconds while the
  // org-wide one, which skips this whole function, completed comfortably.
  await computeBreakEvenAnalysis(supabase, schoolId, classes);

  const sortedPrograms = [...programs].sort((a, b) => b.netMargin - a.netMargin);
  const beSummary = summarizeBreakEven(classes);

  return {
    ebitda: school.ebitda,
    /**
     * CASH POSITION IS A BALANCE, NOT A FLOW. This read `school.cashFlow` —
     * cash COLLECTED through JAG invoices this calendar year — under a label
     * that means the money in the bank. Both are real quantities; they are not
     * the same quantity, and the one being shown reads $0 for every school
     * because JAG has never issued an invoice. Square does the billing.
     *
     * It now takes the QuickBooks balance-sheet figure, which is where the
     * Founder Brief's cash tile comes from, so the two screens agree. Null when
     * no book is connected, and the panel says so rather than showing a zero
     * that means "we did not look".
     */
    cashPosition: school.quickbooksCash,
    /** Unchanged: cash collected through JAG invoices, correctly named. */
    cashCollectedYtd: school.cashFlow,
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
    .select(FI_ALERT_COLS)
    .eq("is_resolved", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}
