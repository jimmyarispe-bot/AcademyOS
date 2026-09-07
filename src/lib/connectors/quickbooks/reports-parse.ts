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

function walk(rows: QboReportRow[] | undefined, visit: (row: QboReportRow) => void): void {
  for (const row of rows ?? []) {
    visit(row);
    walk(row.Rows?.Row, visit);
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
export function sumMatchingAccounts(
  report: QboReport,
  patterns: RegExp[]
): number | null {
  let total: number | null = null;
  walk(report.Rows?.Row, (row) => {
    // Leaf rows carry ColData directly and have no child Rows.
    if (!row.ColData || row.Rows?.Row?.length) return;
    const name = label(row);
    if (!name) return;
    if (!patterns.some((p) => p.test(name))) return;
    const amount = amountOf(row.ColData);
    if (amount === null) return;
    total = (total ?? 0) + amount;
  });
  return total;
}

const PAYROLL = [
  /payroll/i,
  /\bwages?\b/i,
  /salar(y|ies)/i,
  /\bcompensation\b/i,
  /employee benefits?/i,
  /payroll tax/i,
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
  payrollExpense: number | null;
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
    payrollExpense: sumMatchingAccounts(report, PAYROLL),
    depreciation: sumMatchingAccounts(report, DEPRECIATION),
    amortization: sumMatchingAccounts(report, AMORTIZATION),
    interestExpense: sumMatchingAccounts(report, INTEREST),
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
