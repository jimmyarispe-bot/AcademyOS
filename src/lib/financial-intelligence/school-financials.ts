import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { SchoolFinancialsRow } from "@/lib/financial-intelligence/types";
import { healthFromMargin } from "@/lib/financial-intelligence/types";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/**
 * Cash actually collected this calendar year, for THIS school.
 *
 * WHAT WAS HERE BEFORE, and why it never worked:
 *
 *     supabase.from("payments").select("amount").gte("payment_date", yearStart)
 *
 * Three faults, and the third one hid the first two.
 *
 *   1. `payments` has no `payment_date` column. The date is `paid_at`.
 *   2. `payments` has no `school_id` either. School is reached the long way:
 *      payments -> invoices -> family_billing_accounts.school_id. So even had
 *      the date column existed, every school would have reported the same
 *      organisation-wide total.
 *   3. PostgREST answers a filter on a column that does not exist with an
 *      ERROR, not with rows. The caller destructured `{ data: payments }`,
 *      got null, and `(payments ?? []).reduce(...)` turned that into 0.
 *
 * So cashFlow has read exactly 0 for every school for as long as this file has
 * existed, on the executive dashboard and in every fi_profitability_snapshots
 * row, and nothing anywhere said so. Same shape as the cron that authenticated
 * as nobody: zero rows and no error is a refusal wearing a success costume.
 *
 * Hence the explicit error check below. If this query is ever wrong again it
 * says so in the logs instead of quietly reporting no money.
 */
async function loadCashCollected(
  supabase: AuthClient,
  schoolId: string,
  yearStart: string
): Promise<number> {
  const { data, error } = await supabase
    .from("payments")
    .select("amount, invoices!inner(family_billing_accounts!inner(school_id))")
    .eq("invoices.family_billing_accounts.school_id", schoolId)
    .eq("payment_status", "completed")
    .gte("paid_at", `${yearStart}T00:00:00Z`);

  if (error) {
    console.error("[computeSchoolFinancials] cash collected query failed", {
      schoolId,
      error: error.message,
    });
    return 0;
  }

  return (data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
}

export async function computeSchoolFinancials(
  supabase: AuthClient,
  schoolId: string
): Promise<SchoolFinancialsRow> {
  const dashboard = await getFinanceExecutiveDashboard(supabase, schoolId);
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [{ count: enrollment }, { count: sections }, { count: teachers }, cashFlow] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("lifecycle_stage", "active"),
    supabase.from("course_sections").select("id, courses!inner(school_id)", { count: "exact", head: true }).eq("courses.school_id", schoolId),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("employment_status", "active"),
    loadCashCollected(supabase, schoolId, yearStart),
  ]);

  const revenue = dashboard.totalCollected;
  // PLACEHOLDERS, NOT MEASUREMENTS.
  // Nothing in this codebase reads an actual expense, so payroll and expenses
  // are two constants applied to revenue. The arithmetic below therefore makes
  // ebitda always exactly 27% of revenue, operatingMargin always 27.0,
  // netMargin always 22.95, and healthFromMargin(22.95) always "green" -- for
  // every school, every night, regardless of how the school is doing.
  //
  // Real figures come from QuickBooks: one company file per school, exported as
  // Transaction Detail by Account. fi_external_transactions is the table an
  // import lands in; as of 7 Sept 2026 it has two writers and no readers, so
  // importing changes nothing yet. Until a reader exists, every margin on this
  // row is decoration and should not be quoted to anyone.
  const payroll = revenue * 0.45;
  const expenses = payroll + revenue * 0.28;
  const ebitda = revenue - expenses;
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
