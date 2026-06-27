import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ScenarioInput, ScenarioResult } from "@/lib/financial-intelligence/types";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";
import { getLatestForecast } from "@/lib/finance/forecasting";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function runScenario(
  supabase: AuthClient,
  schoolId: string,
  input: ScenarioInput,
  scenarioId?: string
): Promise<ScenarioResult> {
  const [baseline, forecast] = await Promise.all([
    getFinanceExecutiveDashboard(supabase, schoolId),
    getLatestForecast(supabase, schoolId),
  ]);

  const baseRevenue = baseline.totalBilled;
  const basePayroll = Number(forecast?.actual_payroll ?? forecast?.forecast_payroll ?? baseRevenue * 0.45);
  const baseExpenses = basePayroll + baseRevenue * 0.25;

  const tuitionMult = 1 + (input.tuitionChangePct ?? 0) / 100;
  const enrollmentMult = 1 + (input.enrollmentChangePct ?? 0) / 100;
  const scholarshipMult = 1 + (input.scholarshipChangePct ?? 0) / 100;
  const salaryMult = 1 + (input.salaryIncreasePct ?? 0) / 100;

  const projectedRevenue = baseRevenue * tuitionMult * enrollmentMult;
  const projectedPayroll = basePayroll * salaryMult + (input.teacherHires ?? 0) * 55000 / 12;
  const facilityCost = input.facilityExpansionCost ?? 0;
  const projectedExpenses =
    projectedPayroll +
    baseRevenue * 0.25 * enrollmentMult +
    baseline.scholarshipsAwarded * scholarshipMult +
    facilityCost / 12;

  const projectedEbitda = projectedRevenue - projectedExpenses;
  const projectedCashFlow = projectedEbitda * 0.7;
  const projectedMarginPct = projectedRevenue ? (projectedEbitda / projectedRevenue) * 100 : 0;

  const result: ScenarioResult = {
    projectedRevenue,
    projectedExpenses,
    projectedPayroll,
    projectedEbitda,
    projectedCashFlow,
    projectedMarginPct,
    deltaRevenue: projectedRevenue - baseRevenue,
    deltaEbitda: projectedEbitda - (baseRevenue - baseExpenses),
  };

  if (scenarioId) {
    await supabase.from("fi_scenario_results").insert({
      scenario_id: scenarioId,
      projected_revenue: result.projectedRevenue,
      projected_expenses: result.projectedExpenses,
      projected_payroll: result.projectedPayroll,
      projected_ebitda: result.projectedEbitda,
      projected_cash_flow: result.projectedCashFlow,
      projected_margin_pct: result.projectedMarginPct,
      delta_revenue: result.deltaRevenue,
      delta_ebitda: result.deltaEbitda,
      outputs: input as Record<string, unknown>,
    });
    await supabase.from("fi_scenarios").update({ status: "computed" }).eq("id", scenarioId);
  }

  return result;
}

export async function createScenario(
  supabase: AuthClient,
  input: {
    schoolId: string;
    name: string;
    scenarioType: string;
    inputs: ScenarioInput;
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("fi_scenarios")
    .insert({
      school_id: input.schoolId,
      name: input.name,
      scenario_type: input.scenarioType,
      inputs: input.inputs as Record<string, unknown>,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  const result = await runScenario(supabase, input.schoolId, input.inputs, data.id);
  return { id: data.id, result };
}

export async function getScenarios(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("fi_scenarios").select("*, fi_scenario_results(*)").order("created_at", { ascending: false }).limit(20);
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}
