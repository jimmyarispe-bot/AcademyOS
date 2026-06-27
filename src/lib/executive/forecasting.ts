import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getLatestForecast } from "@/lib/finance/forecasting";
import type { ForecastScenario } from "@/lib/executive/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getForecastingCenter(supabase: AuthClient, schoolId: string) {
  const [baseline, scenarios] = await Promise.all([
    getLatestForecast(supabase, schoolId),
    supabase
      .from("executive_forecast_scenarios")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    baseline,
    scenarios: (scenarios.data ?? []) as ForecastScenario[],
  };
}

export async function buildScenarioProjections(
  supabase: AuthClient,
  schoolId: string,
  assumptions: {
    enrollmentGrowthPct?: number;
    scholarshipGrowthPct?: number;
    payrollGrowthPct?: number;
  }
) {
  const baseline = await getLatestForecast(supabase, schoolId);
  const enrollment = Number(baseline?.enrollment_count ?? 0);
  const growth = 1 + (assumptions.enrollmentGrowthPct ?? 0) / 100;

  return {
    forecast_enrollment: Math.round(enrollment * growth),
    forecast_tuition: Number(baseline?.forecast_tuition ?? 0) * growth,
    forecast_scholarships:
      Number(baseline?.forecast_scholarships ?? 0) * (1 + (assumptions.scholarshipGrowthPct ?? 0) / 100),
    forecast_state_funding: Number(baseline?.forecast_state_funding ?? 0),
    forecast_payroll:
      Number(baseline?.forecast_payroll ?? 0) * (1 + (assumptions.payrollGrowthPct ?? 5) / 100),
    forecast_capacity: Math.round(enrollment * growth * 1.1),
  };
}
