import type { createAuthClient } from "@/lib/supabase/server-auth";

/**
 * Real per-school figures from the QuickBooks books.
 *
 * WHY THIS EXISTS. `computeSchoolFinancials` has carried
 *
 *     const payroll  = revenue * 0.45;
 *     const expenses = payroll + revenue * 0.28;
 *
 * since the file was written. That arithmetic makes `operatingMargin` exactly
 * 27.0, `netMargin` exactly 22.95 and `healthFromMargin` exactly "green" for
 * every school, every night, no matter how the school is actually doing. Those
 * are the shape of the formula, not the shape of the business, and they have
 * been rendered on the executive dashboard as though they were measurements.
 *
 * Migration 301 created `fi_quickbooks_financials` and the QuickBooks sync now
 * fills it — one row per (connection, period, accounting method), straight off a
 * QuickBooks report. `fi_quickbooks_connections.school_id` maps a company file
 * to a JAG school. So the real numbers exist; nothing was reading them.
 *
 * ACCRUAL, BY DECISION. Jimmy chose accrual for the Founder Brief on 8 September
 * and this reads the same basis, so the two surfaces cannot disagree. The
 * cash-basis rows stay in the table for the tax view.
 *
 * ONE SCHOOL CAN HAVE MORE THAN ONE BOOK, and the sum is taken across all of a
 * school's connections for the SAME period. Summing a full year against a
 * year-to-date would produce a number that is not any period at all, so periods
 * that do not match the latest one are dropped and counted, not quietly folded
 * in.
 */

const METHOD = "Accrual" as const;

export type SchoolQuickBooksFigures = {
  periodStart: string;
  periodEnd: string;
  /** Books that contributed. */
  booksUsed: number;
  /** Books mapped to this school whose period did not match the latest one. */
  booksSkipped: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  /** Summed balance-sheet cash, or null when no book reported one. */
  cash: number | null;
};

/**
 * `fi_quickbooks_financials` and `fi_quickbooks_connections` came from hand-run
 * migrations and are absent from the generated `database.ts`, which stops at the
 * committed migrations. `founder-financials.ts` and `persistence.ts` solve this
 * the same way: a narrow structural type for exactly the call being made, so the
 * columns below are the contract rather than an `any`.
 */
type LooseConnections = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => PromiseLike<{
        data: Array<{ id: string }> | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type FinancialsRow = {
  connection_id: string;
  period_start: string;
  period_end: string;
  total_income: number | null;
  total_expenses: number | null;
  net_income: number | null;
  cash_balance: number | null;
};

type LooseFinancials = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        in: (
          column: string,
          values: string[]
        ) => {
          order: (
            column: string,
            options: { ascending: boolean }
          ) => PromiseLike<{
            data: FinancialsRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

export type QuickBooksLookup =
  | { ok: true; figures: SchoolQuickBooksFigures }
  | { ok: false; reason: string };

export async function getSchoolQuickBooksFigures(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  schoolId: string
): Promise<QuickBooksLookup> {
  // Check the returned error on every read. A PostgREST refusal — RLS, or a
  // column that does not exist — resolves rather than throws, with `data` null.
  // Six faults in this codebase have been exactly that shape, and the last one
  // reported "no money" for every school for months.
  const { data: conns, error: connError } = await (supabase as unknown as LooseConnections)
    .from("fi_quickbooks_connections")
    .select("id")
    .eq("school_id", schoolId);

  if (connError) return { ok: false, reason: `QuickBooks connection read failed: ${connError.message}` };

  const ids = (conns ?? []).map((c) => c.id);
  if (!ids.length) return { ok: false, reason: "No QuickBooks company file is mapped to this school" };

  const { data, error } = await (supabase as unknown as LooseFinancials)
    .from("fi_quickbooks_financials")
    .select(
      "connection_id, period_start, period_end, total_income, total_expenses, net_income, cash_balance"
    )
    .eq("accounting_method", METHOD)
    .in("connection_id", ids)
    .order("period_end", { ascending: false });

  if (error) return { ok: false, reason: `Ledger read failed: ${error.message}` };

  const rows = data ?? [];
  if (!rows.length) return { ok: false, reason: "No accrual figures have been synced for this school yet" };

  const periodEnd = rows[0].period_end;
  const periodStart = rows.find((r) => r.period_end === periodEnd)?.period_start ?? "";
  const inPeriod = rows.filter((r) => r.period_end === periodEnd && r.period_start === periodStart);

  // Net income is the anchor and must be present in every contributing book. A
  // missing one would silently drop that book from the total, which is the exact
  // failure this file exists to end.
  if (inPeriod.some((r) => r.net_income == null)) {
    return { ok: false, reason: "A QuickBooks report for this school did not parse — net income is missing" };
  }

  const total = (pick: (r: FinancialsRow) => number | null) =>
    inPeriod.reduce<number>((a, r) => a + (pick(r) ?? 0), 0);

  const cashBooks = inPeriod.filter((r) => r.cash_balance != null);

  return {
    ok: true,
    figures: {
      periodStart,
      periodEnd,
      booksUsed: inPeriod.length,
      booksSkipped: rows.length - inPeriod.length,
      totalIncome: total((r) => r.total_income),
      totalExpenses: total((r) => r.total_expenses),
      netIncome: total((r) => r.net_income),
      cash: cashBooks.length ? total((r) => r.cash_balance) : null,
    },
  };
}
