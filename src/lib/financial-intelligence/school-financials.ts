import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { SchoolFinancialsRow } from "@/lib/financial-intelligence/types";
import { healthFromMargin } from "@/lib/financial-intelligence/types";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";
import { getSchoolQuickBooksFigures } from "@/lib/financial-intelligence/quickbooks-financials";

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

  /**
   * WHAT USED TO BE HERE:
   *
   *     const payroll  = revenue * 0.45;
   *     const expenses = payroll + revenue * 0.28;
   *
   * Two constants, so ebitda was always exactly 27% of revenue,
   * operatingMargin always 27.0, netMargin always 22.95, and
   * healthFromMargin(22.95) always "green" -- for every school, every night,
   * however the school was actually doing. The dashboard rendered those as
   * measurements for as long as this file has existed.
   *
   * Now the expense side comes off the QuickBooks books, on accrual, per school.
   * WHEN THERE ARE NO REAL FIGURES THIS ROW REPORTS NONE. It does not fall back
   * to a formula: a plausible number nobody can trace is worse than a visible
   * gap, because nothing about it invites a second look. `basisNote` carries the
   * reason and the UI renders that in place of a margin.
   */
  const qb = await getSchoolQuickBooksFigures(supabase, schoolId);

  // Revenue still comes from the billing dashboard when QuickBooks has nothing,
  // because cash collected is a real measurement in its own right. Everything
  // below revenue needs the books.
  const revenue = qb.ok ? qb.figures.totalIncome : dashboard.totalCollected;
  const expenses = qb.ok ? qb.figures.totalExpenses : 0;
  const ebitda = qb.ok ? qb.figures.netIncome : 0;

  // Payroll is NOT broken out by the QuickBooks summary this table stores, so it
  // is reported as 0 rather than estimated from expenses. The Transaction Detail
  // has it account by account; that is a separate reader, not a guess made here.
  const payroll = 0;

  const operatingMargin = qb.ok && revenue ? (ebitda / revenue) * 100 : 0;
  const netMargin = operatingMargin;
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
    // A school with no books has no health to report. "yellow" says "unknown"
    // rather than the "green" the old constants produced unconditionally.
    healthIndicator: qb.ok ? healthFromMargin(netMargin) : "yellow",
    basis: qb.ok ? "quickbooks" : "unavailable",
    basisNote: qb.ok ? null : qb.reason,
    periodStart: qb.ok ? qb.figures.periodStart : null,
    periodEnd: qb.ok ? qb.figures.periodEnd : null,
  };

  /**
   * NO BOOKS, NO SNAPSHOT. Writing zeros into fi_profitability_snapshots would
   * put the same untraceable figures into a table other things read, which is
   * how the 27.0% margin travelled in the first place. A school with no
   * QuickBooks data leaves last night's row alone and says why in the log.
   */
  if (!qb.ok) {
    console.warn("[computeSchoolFinancials] no snapshot written", { schoolId, reason: qb.reason });
    return row;
  }

  const { error: snapshotError } = await supabase.from("fi_profitability_snapshots").upsert(
    {
      school_id: schoolId,
      entity_type: "school",
      entity_id: schoolId,
      entity_key: schoolId,
      period_type: "annual",
      period_start: qb.figures.periodStart || yearStart,
      period_end: qb.figures.periodEnd,
      revenue,
      total_cost: expenses,
      // The QuickBooks summary does not break payroll out of expenses, so there
      // is no gross margin to report distinct from the net. Both carry the same
      // figure rather than one of them carrying an invented split.
      gross_margin: ebitda,
      net_margin: ebitda,
      ebitda_contribution: ebitda,
      margin_pct: netMargin,
      health_indicator: row.healthIndicator,
      enrollment_count: enrollment ?? 0,
      metrics: {
        cash_flow: cashFlow,
        revenue_per_student: row.revenuePerStudent,
        collection_rate: dashboard.collectionRate,
        basis: "quickbooks-accrual",
        books_used: qb.figures.booksUsed,
        books_skipped_wrong_period: qb.figures.booksSkipped,
        quickbooks_cash: qb.figures.cash,
        payroll_note: "not broken out by the QuickBooks summary; see Transaction Detail",
      },
    },
    { onConflict: "school_id,entity_type,entity_id,entity_key,period_type,period_start" }
  );

  // Check the returned error. An RLS refusal here resolves rather than throws,
  // and a snapshot that silently never wrote is indistinguishable from one that
  // did until somebody reads the table weeks later.
  if (snapshotError) {
    console.error("[computeSchoolFinancials] snapshot write failed", {
      schoolId,
      error: snapshotError.message,
    });
  }

  return row;
}
