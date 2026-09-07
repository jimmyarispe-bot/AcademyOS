/**
 * Turning Intuit's report JSON into numbers we are willing to display.
 *
 * QuickBooks reports are a nested tree, not a table. A Section row contains
 * Rows, which contain more Sections, and the totals live in a `Summary` on the
 * enclosing Section rather than beside the lines they sum. Depth varies with
 * how the chart of accounts is organised, so nothing here may assume a level.
 *
 * EVERY FIGURE IS `number | null`, AND THAT IS THE WHOLE POINT.
 *
 * A parser that returns 0 when it cannot find a line is indistinguishable from
 * a business that spent nothing, and the consumer has no way to tell. That is
 * how school-financials.ts ended up asserting a 27.0% operating margin every
 * single day. Here, not-found is null, and the caller must decide what to do
 * about it -- which for EBITDA means refusing to compute rather than
 * publishing a confident wrong number.
 */

export type QboReportRow = {
  Header?: { ColData?: { value?: string }[] };
  Summary?: { ColData?: { value?: string }[] };
  ColData?: { value?: string }[];
  Rows?: { Row?: QboReportRow[] };
  group?: string;
  type?: string;
};

export type QboReport = {
  Header?: { StartPeriod?: string; EndPeriod?: string; ReportName?: string };
  Rows?: { Row?: QboReportRow[] };
};

/** Intuit sends "" for a blank cell and "-1,234.56" for negatives. */
export function parseAmount(raw: string | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return null;
  // Accounting parentheses: (1234.56) means -1234.56
  const negated = /^\((.*)\)$/.exec(cleaned);
  const value = Number(negated ? `-${negated[1]}` : cleaned);
  return Number.isFinite(value) ? value : null;
}

function label(row: QboReportRow): string {
  return (
    row.Header?.ColData?.[0]?.value ??
    row.Summary?.ColData?.[0]?.value ??
    row.ColData?.[0]?.value ??
    ""
  );
}

/** The last column is the period total; earlier columns are sub-periods. */
function amountOf(cols: { value?: string }[] | undefined): number | null {
  if (!cols || cols.length < 2) return null;
  for (let i = cols.length - 1; i >= 1; i--) {
    const value = parseAmount(cols[i]?.value);
    if (value !== null) return value;
  }
  return null;
}

function walk(
  rows: QboReportRow[] | undefined,
  visit: (row: QboReportRow, ancestors: string[]) => void,
  ancestors: string[] = []
): void {
  for (const row of rows ?? []) {
    visit(row, ancestors);
    // A section's own label joins the ancestry of everything beneath it.
    walk(row.Rows?.Row, visit, row.Rows?.Row ? [...ancestors, label(row)] : ancestors);
  }
}

/**
 * A Section's total, found by its `group`.
 *
 * `group` is Intuit's stable machine name -- "Income", "Expenses", "NetIncome",
 * "GrossProfit", "COGS" -- and is far safer than matching the display label,
 * which is localised and user-editable.
 */
export function sectionTotal(report: QboReport, group: string): number | null {
  let found: number | null = null;
  walk(report.Rows?.Row, (row) => {
    if (found === null && row.group === group) {
      found = amountOf(row.Summary?.ColData);
    }
  });
  return found;
}

/**
 * Sum every leaf account whose NAME matches, at any depth.
 *
 * Used for figures with no `group` of their own -- payroll, depreciation,
 * interest. These are ordinary expense accounts whose names are chosen by
 * whoever set up the books, so matching is by intent and deliberately broad.
 * Returns null when nothing matched, so "no depreciation account exists" stays
 * distinguishable from "depreciation was zero".
 */
/** The sections a COST can legitimately come from. */
const EXPENSE_GROUPS = ["Expenses", "COGS", "OtherExpenses"];

/**
 * The rows beneath the named sections, or the whole report when none are named.
 *
 * WITHOUT THIS, A BANK ACCOUNT CAN BE COUNTED AS A COST. Zelle is a payment
 * method, so "Zelle Clearing" is a plausible BALANCE SHEET account name -- and
 * on a report carrying both that account and the contractor expense the money
 * is categorised into, a whole-report walk sums the same dollars twice.
 * 45,561.95 became 91,123.90, and would have looked entirely credible on a
 * dashboard. The test asserts the pair.
 */
function subtreesOf(report: QboReport, groups?: string[]): QboReportRow[] {
  if (!groups) return report.Rows?.Row ?? [];
  const found: QboReportRow[] = [];
  walk(report.Rows?.Row, (row) => {
    if (row.group && groups.includes(row.group)) found.push(row);
  });
  return found;
}

export function sumMatchingAccounts(
  report: QboReport,
  patterns: RegExp[],
  options: { matchAncestors?: boolean; within?: string[] } = {}
): number | null {
  let total: number | null = null;
  const roots = subtreesOf(report, options.within);
  walk(roots, (row, ancestors) => {
    // Leaf rows carry ColData directly and have no child Rows. Summing LEAVES
    // ONLY is what stops a section being counted twice -- once as its own
    // subtotal and again as its children.
    if (!row.ColData || row.Rows?.Row?.length) return;
    const name = label(row);
    if (!name) return;

    const own = patterns.some((p) => p.test(name));
    // WHY ANCESTORS MATTER, from The Academy HS's actual books:
    //
    //   66000 Payroll Expenses          (section)
    //     66100 Payroll Wages           (section)
    //       66150 Independent Contractor Payment   45,561.95   <- the leaf
    //
    // The leaf carries no payroll word at all, because HS pays independent
    // contractors rather than running a W-2 payroll. Matching leaf names alone
    // reported NULL labour cost for a school whose contractors are 94% of its
    // spend. A person reading this report would see the account sitting under
    // "Payroll Expenses" and count it; so does this.
    const inherited =
      options.matchAncestors === true &&
      ancestors.some((a) => patterns.some((p) => p.test(a)));

    if (!own && !inherited) return;
    const amount = amountOf(row.ColData);
    if (amount === null) return;
    total = (total ?? 0) + amount;
  });
  return total;
}

/**
 * LABOUR COST, not "payroll".
 *
 * Two of the four schools run entirely on independent contractors paid by
 * Zelle, not on a W-2 payroll. For every purpose this figure serves -- cost per
 * student, margin, EBITDA -- a contractor teaching a class and an employee
 * teaching a class are the same expense. Calling the concept "payroll" was the
 * mistake; it named an employment arrangement rather than a cost.
 */
const LABOR = [
  /payroll/i,
  /\bwages?\b/i,
  /salar(y|ies)/i,
  /\bcompensation\b/i,
  /employee benefits?/i,
  /payroll tax/i,
  /independent contractor/i,
  /contract labou?r/i,
  /subcontractor/i,
  /\b1099\b/i,
  /\bstipends?\b/i,
  // The two payment rails this network actually pays people through. ADP runs
  // FL and GA's W-2 payroll; HS and Virtual pay contractors by Zelle.
  //
  // ADP is unambiguous -- nothing else in a chart of accounts is called that.
  // ZELLE IS NOT. It is a payment METHOD, and an account named for it could be
  // a bank or clearing account rather than an expense. Where Zelle payments are
  // categorised into a contractor account -- which is what HS's books do --
  // this pattern must not match a second account carrying the same money.
  // The guard is the test below: HS's labour is 45,561.95, once.
  /\badp\b/i,
  /\bzelle\b/i,
];
const DEPRECIATION = [/depreciation/i];
const AMORTIZATION = [/amorti[sz]ation/i];
const INTEREST = [/interest expense/i, /\binterest\b(?!.*income)/i];

export type ParsedProfitAndLoss = {
  periodStart: string | null;
  periodEnd: string | null;
  totalIncome: number | null;
  totalCogs: number | null;
  totalExpenses: number | null;
  netIncome: number | null;
  laborExpense: number | null;
  depreciation: number | null;
  amortization: number | null;
  interestExpense: number | null;
};

export function parseProfitAndLoss(report: QboReport): ParsedProfitAndLoss {
  return {
    periodStart: report.Header?.StartPeriod ?? null,
    periodEnd: report.Header?.EndPeriod ?? null,
    totalIncome: sectionTotal(report, "Income"),
    totalCogs: sectionTotal(report, "COGS"),
    totalExpenses: sectionTotal(report, "Expenses"),
    netIncome: sectionTotal(report, "NetIncome"),
    // matchAncestors: a sub-account under a Payroll section is labour even
    // when its own name never says so.
    laborExpense: sumMatchingAccounts(report, LABOR, {
      matchAncestors: true,
      within: EXPENSE_GROUPS,
    }),
    depreciation: sumMatchingAccounts(report, DEPRECIATION, { within: EXPENSE_GROUPS }),
    amortization: sumMatchingAccounts(report, AMORTIZATION, { within: EXPENSE_GROUPS }),
    interestExpense: sumMatchingAccounts(report, INTEREST, { within: EXPENSE_GROUPS }),
  };
}

/**
 * Cash from a Balance Sheet.
 *
 * Intuit groups bank accounts under the "BankAccounts" section on the standard
 * Balance Sheet. Falling back to name matching would sweep in anything a
 * bookkeeper called "Cash reserve" that is not actually a bank account, so this
 * only trusts the group -- and returns null when it is absent.
 */
export function parseBalanceSheetCash(report: QboReport): number | null {
  return sectionTotal(report, "BankAccounts");
}
