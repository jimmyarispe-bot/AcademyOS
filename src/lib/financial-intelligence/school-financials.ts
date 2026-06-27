import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { SchoolFinancialsRow } from "@/lib/financial-intelligence/types";
import { healthFromMargin } from "@/lib/financial-intelligence/types";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function computeSchoolFinancials(
  supabase: AuthClient,
  schoolId: string
): Promise<SchoolFinancialsRow> {
  const dashboard = await getFinanceExecutiveDashboard(supabase, schoolId);
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [{ count: enrollment }, { count: sections }, { count: teachers }, { data: payments }] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("lifecycle_stage", "active"),
    supabase.from("course_sections").select("id, courses!inner(school_id)", { count: "exact", head: true }).eq("courses.school_id", schoolId),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("employment_status", "active"),
    supabase.from("payments").select("amount").gte("payment_date", yearStart),
  ]);

  const revenue = dashboard.totalCollected;
  const payroll = revenue * 0.45;
  const expenses = payroll + revenue * 0.28;
  const ebitda = revenue - expenses;
  const cashFlow = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const operatingMargin = revenue ? ((revenue - expenses) / revenue) * 100 : 0;
  const netMargin = operatingMargin * 0.85;
  const enc = enrollment ?? 1;

  const row: SchoolFinancialsRow = {
    schoolId,
    revenue,
    expenses,
    payroll,
    ebitda,
    cashFlow,
    operatingMargin,
    netMargin,
    enrollmentRevenue: dashboard.totalBilled,
    revenuePerStudent: revenue / enc,
    revenuePerClassroom: sections ? revenue / sections : revenue,
    revenuePerTeacher: teachers ? revenue / teachers : revenue,
    healthIndicator: healthFromMargin(netMargin),
  };

  await supabase.from("fi_profitability_snapshots").upsert(
    {
      school_id: schoolId,
      entity_type: "school",
      entity_id: schoolId,
      entity_key: schoolId,
      period_type: "annual",
      period_start: yearStart,
      period_end: new Date().toISOString().split("T")[0],
      revenue,
      total_cost: expenses,
      gross_margin: revenue - payroll,
      net_margin: ebitda,
      ebitda_contribution: ebitda,
      margin_pct: netMargin,
      health_indicator: row.healthIndicator,
      enrollment_count: enrollment ?? 0,
      metrics: {
        cash_flow: cashFlow,
        revenue_per_student: row.revenuePerStudent,
        collection_rate: dashboard.collectionRate,
      },
    },
    { onConflict: "school_id,entity_type,entity_id,entity_key,period_type,period_start" }
  );

  return row;
}
