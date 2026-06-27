import type { createAuthClient } from "@/lib/supabase/server-auth";
import { buildBudgetForecastSnapshot, getLatestForecast } from "@/lib/finance/forecasting";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function refreshFinancialForecast(supabase: AuthClient, schoolId: string) {
  return buildBudgetForecastSnapshot(supabase, schoolId);
}

export async function getFinancialForecastSummary(supabase: AuthClient, schoolId?: string) {
  const forecast = await getLatestForecast(supabase, schoolId);
  if (!forecast) return null;

  return {
    forecastTuition: Number(forecast.forecast_tuition),
    forecastScholarships: Number(forecast.forecast_scholarships),
    forecastStateFunding: Number(forecast.forecast_state_funding),
    forecastPayroll: Number(forecast.forecast_payroll),
    actualTuition: Number(forecast.actual_tuition),
    actualPayroll: Number(forecast.actual_payroll),
    enrollmentCount: forecast.enrollment_count,
    snapshotName: forecast.snapshot_name,
  };
}

export async function projectCashBurn(
  supabase: AuthClient,
  schoolId: string,
  months = 6
) {
  const forecast = await getLatestForecast(supabase, schoolId);
  const monthlyRevenue = Number(forecast?.actual_tuition ?? 0) / 12;
  const monthlyExpenses = (Number(forecast?.actual_payroll ?? 0) + monthlyRevenue * 0.3) / 12;

  const projections = [];
  let cash = monthlyRevenue * 2;
  for (let i = 1; i <= months; i++) {
    cash += monthlyRevenue - monthlyExpenses;
    projections.push({ month: i, projectedCash: cash, burn: monthlyExpenses - monthlyRevenue });
  }

  return projections;
}
