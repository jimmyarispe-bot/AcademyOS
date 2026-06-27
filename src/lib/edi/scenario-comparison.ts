import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { EdiScenarioInput, EdiScenarioResult } from "@/lib/edi/types";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";
import { getCommandCenterMetrics } from "@/lib/executive/command-center";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function runEdiScenario(
  supabase: AuthClient,
  schoolId: string,
  input: EdiScenarioInput,
  scenarioId?: string
): Promise<EdiScenarioResult> {
  const [finance, metrics] = await Promise.all([
    getFinanceExecutiveDashboard(supabase, schoolId),
    getCommandCenterMetrics(supabase, schoolId),
  ]);

  const baseRevenue = finance.totalBilled;
  const baseEnrollment = metrics.enrollment || 100;
  const basePayroll = baseRevenue * 0.45;
  const baseExpenses = basePayroll + baseRevenue * 0.28;

  const tuitionMult = 1 + (input.tuitionChangePct ?? 0) / 100;
  const enrollmentMult = 1 + (input.enrollmentChangePct ?? 0) / 100;
  const classSizeMult = 1 + (input.classSizeIncrease ?? 0) / 100;

  const projectedRevenue = baseRevenue * tuitionMult * enrollmentMult;
  const projectedEnrollment = baseEnrollment * enrollmentMult * classSizeMult;
  const projectedPayroll = basePayroll + (input.teacherHires ?? 0) * 55000 / 12 + basePayroll * ((input.tuitionChangePct ?? 0) > 0 ? 0.02 : 0);
  const facilityCost = (input.facilityLeaseCost ?? 0) / 12 + (input.campusExpansionPct ?? 0) * baseRevenue * 0.01;
  const sectionDelta = (input.sectionsAdded ?? 0) - (input.sectionsClosed ?? 0);
  const projectedExpenses = projectedPayroll + baseRevenue * 0.28 * enrollmentMult + facilityCost + sectionDelta * 3000;

  const projectedEbitda = projectedRevenue - projectedExpenses;
  const projectedCashFlow = projectedEbitda * 0.7;
  const projectedMarginPct = projectedRevenue ? (projectedEbitda / projectedRevenue) * 100 : 0;

  const result: EdiScenarioResult = {
    projectedRevenue,
    projectedExpenses,
    projectedEnrollment,
    projectedEbitda,
    projectedCashFlow,
    projectedMarginPct,
    operationalImpact: {
      sections_added: input.sectionsAdded ?? 0,
      sections_closed: input.sectionsClosed ?? 0,
      teacher_hires: input.teacherHires ?? 0,
    },
    studentSuccessImpact: {
      enrollment_change: projectedEnrollment - baseEnrollment,
      class_size_change_pct: input.classSizeIncrease ?? 0,
    },
  };

  if (scenarioId) {
    await supabase.from("edi_scenario_results").insert({
      scenario_id: scenarioId,
      projected_revenue: result.projectedRevenue,
      projected_expenses: result.projectedExpenses,
      projected_enrollment: result.projectedEnrollment,
      projected_ebitda: result.projectedEbitda,
      projected_cash_flow: result.projectedCashFlow,
      projected_margin_pct: result.projectedMarginPct,
      operational_impact: result.operationalImpact,
      student_success_impact: result.studentSuccessImpact,
      delta_summary: {
        delta_revenue: projectedRevenue - baseRevenue,
        delta_ebitda: projectedEbitda - (baseRevenue - baseExpenses),
      },
    });
    await supabase.from("edi_scenarios").update({ status: "computed" }).eq("id", scenarioId);
  }

  return result;
}

export async function createEdiScenario(
  supabase: AuthClient,
  input: {
    schoolId: string;
    name: string;
    scenarioType: string;
    scenarioGroup?: string;
    inputs: EdiScenarioInput;
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("edi_scenarios")
    .insert({
      school_id: input.schoolId,
      name: input.name,
      scenario_type: input.scenarioType,
      scenario_group: input.scenarioGroup ?? "comparison",
      inputs: input.inputs as Record<string, unknown>,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  const result = await runEdiScenario(supabase, input.schoolId, input.inputs, data.id);
  return { id: data.id, result };
}

export async function compareScenarios(supabase: AuthClient, schoolId: string, scenarioGroup = "comparison") {
  const { data } = await supabase
    .from("edi_scenarios")
    .select("*, edi_scenario_results(*)")
    .eq("school_id", schoolId)
    .eq("scenario_group", scenarioGroup)
    .order("created_at", { ascending: false })
    .limit(10);

  return data ?? [];
}

export async function runScenarioComparisonSet(supabase: AuthClient, schoolId: string, createdBy?: string) {
  const presets: Array<{ name: string; type: string; inputs: EdiScenarioInput }> = [
    { name: "Tuition +5%", type: "tuition_increase", inputs: { tuitionChangePct: 5 } },
    { name: "Tuition +10%", type: "tuition_increase", inputs: { tuitionChangePct: 10 } },
    { name: "Hire 1 teacher", type: "hire_teacher", inputs: { teacherHires: 1, enrollmentChangePct: 5 } },
    { name: "Increase class size 10%", type: "increase_class_size", inputs: { classSizeIncrease: 10 } },
    { name: "Open 1 section", type: "open_section", inputs: { sectionsAdded: 1, enrollmentChangePct: 8 } },
    { name: "Close 1 section", type: "close_section", inputs: { sectionsClosed: 1 } },
  ];

  const results = [];
  for (const preset of presets) {
    const r = await createEdiScenario(supabase, {
      schoolId,
      name: preset.name,
      scenarioType: preset.type,
      scenarioGroup: "comparison",
      inputs: preset.inputs,
      createdBy,
    });
    results.push(r);
  }
  return results;
}
