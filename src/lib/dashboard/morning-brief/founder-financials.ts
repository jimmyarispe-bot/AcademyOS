import { createAuthClient } from "@/lib/supabase/server-auth";

/**
 * Adjusted EBITDA and cash for the Founder Brief, from the QuickBooks books.
 *
 * Reads `fi_quickbooks_financials`, which the QuickBooks sync writes one row per
 * (connection, period, accounting method). Nothing is computed from a ratio and
 * nothing is estimated: every figure here came out of a QuickBooks report.
 *
 * That matters because the figures this replaces were not measurements. The
 * executive financial path still carries `payroll = revenue * 0.45` and
 * `expenses = payroll + revenue * 0.28`, which is why `operatingMargin` reads
 * 27.0 and `netMargin` 22.95 for every school on every run. Those are the shape
 * of the formula, not the shape of the business.
 *
 * ACCRUAL, BY DECISION. Jimmy chose accrual for the brief on 2026-09-08. EBITDA
 * is a performance measure and belongs on the basis that matches revenue to the
 * period it was earned; the cash-basis figures remain in the same table and
 * reconcile to the filed 1120-S to $0.07, so the tax view is not lost by making
 * accrual the default here.
 */

const METHOD = "Accrual" as const;

/** Scopes that represent a real JAG book. `unassigned` is a connection nobody has mapped yet. */
const COUNTED_SCOPES = ["school", "network", "entity"];

export type FounderFinancials = {
  accountingMethod: typeof METHOD;
  periodStart: string;
  periodEnd: string;
  /** Books that contributed to these figures. */
  booksIncluded: number;
  /** Company names present in the table but left out, with the reason. */
  booksExcluded: Array<{ company: string; reason: string }>;

  /** Net income + interest + depreciation + amortisation. Null if any book's net income is absent. */
  ebitda: number | null;
  netIncome: number | null;
  totalIncome: number | null;
  totalExpenses: number | null;
  addBacks: { interest: number; depreciation: number; amortization: number };

  /** Summed balance-sheet cash. Null if no book reported one. */
  cash: number | null;
  /** Books whose balance sheet did not come back. Cash is understated by exactly these. */
  cashBooksMissing: number;

  /** Positive means money is leaving. Null when the period is profitable. */
  monthlyBurn: number | null;
  runwayMonths: number | null;

  /** Set when the tiles cannot be shown at all. The tile renders this instead of a number. */
  unavailable: string | null;
};

/**
 * `fi_quickbooks_financials` was created by hand-run migration 301 and is not in
 * the generated `database.ts`, which stops at the committed migrations. The
 * generated types therefore resolve an unknown table to `GenericStringError[]`.
 * `financials-sync.ts` solves the same problem the same way, with a narrow
 * structural type for exactly the call being made — the shape is asserted in one
 * place and the columns below are the contract.
 */
type LooseConnectionsClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[]
      ) => PromiseLike<{
        data: Array<{ id: string; company_name: string | null }> | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type LooseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        order: (
          column: string,
          options: { ascending: boolean }
        ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
      };
    };
  };
};

type Row = {
  /**
   * The book's identity. company_name is NOT on this table - it lives on
   * fi_quickbooks_connections. Selecting it here returned
   * "column fi_quickbooks_financials.company_name does not exist" and the tiles
   * rendered that reason, which is the honest failure and how it was found.
   */
  connection_id: string;
  scope: string | null;
  period_start: string;
  period_end: string;
  total_income: number | null;
  total_expenses: number | null;
  net_income: number | null;
  depreciation: number | null;
  amortization: number | null;
  interest_expense: number | null;
  cash_balance: number | null;
};

function monthsBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    // A period ending on the 31st covers that month; ending on the 1st does not.
    (end.getDate() >= 28 ? 1 : 0);
  return Math.max(1, months);
}

function unavailable(reason: string): FounderFinancials {
  return {
    accountingMethod: METHOD,
    periodStart: "",
    periodEnd: "",
    booksIncluded: 0,
    booksExcluded: [],
    ebitda: null,
    netIncome: null,
    totalIncome: null,
    totalExpenses: null,
    addBacks: { interest: 0, depreciation: 0, amortization: 0 },
    cash: null,
    cashBooksMissing: 0,
    monthlyBurn: null,
    runwayMonths: null,
    unavailable: reason,
  };
}

export async function getFounderFinancials(): Promise<FounderFinancials> {
  const supabase = await createAuthClient();

  // Check the error. A PostgREST refusal — RLS, or a column that does not exist —
  // resolves rather than throws, and `data` comes back null with `error` set.
  // Five faults in this codebase have been exactly that shape.
  const { data, error } = await (supabase as unknown as LooseClient)
    .from("fi_quickbooks_financials")
    .select(
      "connection_id, scope, period_start, period_end, total_income, total_expenses, " +
        "net_income, depreciation, amortization, interest_expense, cash_balance"
    )
    .eq("accounting_method", METHOD)
    .order("period_end", { ascending: false });

  if (error) return unavailable(`Ledger read failed: ${error.message}`);

  const all = data ?? [];
  if (!all.length) return unavailable("No accrual figures synced yet");

  // Anchor on the most recent period, and take only books reporting that same
  // window. Summing a full year against a year-to-date would produce a number
  // that is not any period at all.
  const latestEnd = all[0].period_end;
  const latestStart = all.find((r) => r.period_end === latestEnd)?.period_start ?? "";
  const inPeriod = all.filter(
    (r) => r.period_end === latestEnd && r.period_start === latestStart
  );

  // Collected by id, resolved to names once at the end - the name is only
  // needed to explain an exclusion, and most runs have none to explain.
  const excludedIds: Array<{ connectionId: string; reason: string }> = [];
  const books = inPeriod.filter((r) => {
    if (!COUNTED_SCOPES.includes(String(r.scope))) {
      excludedIds.push({ connectionId: r.connection_id, reason: "not mapped to an entity" });
      return false;
    }
    return true;
  });

  if (!books.length) return unavailable("No mapped books for the latest period");

  // Net income is the anchor and must be present in every book. A missing one
  // would silently drop that entity from the consolidated figure, which is the
  // failure this whole file exists to avoid.
  const missingNetIncome = books.filter((r) => r.net_income == null);

  const total = (pick: (r: Row) => number | null) =>
    books.reduce<number>((a, r) => a + (pick(r) ?? 0), 0);

  // Add-backs default to zero rather than null ON PURPOSE, and only these three.
  // A P&L with no depreciation account genuinely has no depreciation, so the
  // add-back is zero. Net income is different: it is on every P&L, so its
  // absence means the report did not parse, not that the business broke even.
  const addBacks = {
    interest: total((r) => r.interest_expense),
    depreciation: total((r) => r.depreciation),
    amortization: total((r) => r.amortization),
  };

  const netIncome = missingNetIncome.length ? null : total((r) => r.net_income);

  // No tax add-back. There is no tax column, and these entities are
  // pass-through — the 1120-S carries no entity-level income tax — so the T in
  // EBITDA is zero here rather than omitted. Revisit if a C-corp is ever added.
  const ebitda =
    netIncome == null
      ? null
      : netIncome + addBacks.interest + addBacks.depreciation + addBacks.amortization;

  const cashBooks = books.filter((r) => r.cash_balance != null);
  const cash = cashBooks.length ? total((r) => r.cash_balance) : null;

  const months = monthsBetween(latestStart, latestEnd);
  const monthlyBurn = netIncome != null && netIncome < 0 ? -netIncome / months : null;
  const runwayMonths =
    cash != null && cash > 0 && monthlyBurn != null && monthlyBurn > 0
      ? cash / monthlyBurn
      : null;

  for (const r of missingNetIncome) {
    excludedIds.push({ connectionId: r.connection_id, reason: "net income did not parse" });
  }

  // Name the excluded books, if there are any. One extra round trip, only when
  // there is something to explain.
  let excluded: FounderFinancials["booksExcluded"] = [];
  if (excludedIds.length) {
    const { data: conns } = await (supabase as unknown as LooseConnectionsClient)
      .from("fi_quickbooks_connections")
      .select("id, company_name")
      .in(
        "id",
        excludedIds.map((e) => e.connectionId)
      );
    const nameById = new Map((conns ?? []).map((c) => [c.id, c.company_name]));
    excluded = excludedIds.map((e) => ({
      company: nameById.get(e.connectionId) ?? "Unnamed book",
      reason: e.reason,
    }));
  }

  return {
    accountingMethod: METHOD,
    periodStart: latestStart,
    periodEnd: latestEnd,
    booksIncluded: books.length,
    booksExcluded: excluded,
    ebitda,
    netIncome,
    totalIncome: total((r) => r.total_income),
    totalExpenses: total((r) => r.total_expenses),
    addBacks,
    cash,
    cashBooksMissing: books.length - cashBooks.length,
    monthlyBurn,
    runwayMonths,
    unavailable: null,
  };
}
