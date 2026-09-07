import { describe, expect, it } from "vitest";
import {
  parseAmount,
  parseProfitAndLoss,
  parseBalanceSheetCash,
  sumMatchingAccounts,
  type QboReport,
} from "@/lib/connectors/quickbooks/reports-parse";

/**
 * Shaped like a real Intuit ProfitAndLoss: totals live on the enclosing
 * Section's Summary, leaf accounts sit at varying depth, and the sub-account
 * nesting under Payroll Expenses is exactly the structure that a level-assuming
 * parser gets wrong.
 */
const PL: QboReport = {
  Header: { StartPeriod: "2026-01-01", EndPeriod: "2026-08-31", ReportName: "ProfitAndLoss" },
  Rows: {
    Row: [
      {
        type: "Section",
        group: "Income",
        Rows: {
          Row: [
            { ColData: [{ value: "Tuition Income" }, { value: "438900.00" }] },
            { ColData: [{ value: "Scholarship Income" }, { value: "112400.00" }] },
          ],
        },
        Summary: { ColData: [{ value: "Total Income" }, { value: "551300.00" }] },
      },
      {
        type: "Section",
        group: "Expenses",
        Rows: {
          Row: [
            {
              type: "Section",
              Header: { ColData: [{ value: "Payroll Expenses" }] },
              Rows: {
                Row: [
                  { ColData: [{ value: "Salaries & Wages" }, { value: "236000.00" }] },
                  { ColData: [{ value: "Payroll Taxes" }, { value: "18400.00" }] },
                ],
              },
              Summary: { ColData: [{ value: "Total Payroll Expenses" }, { value: "254400.00" }] },
            },
            { ColData: [{ value: "Rent" }, { value: "96000.00" }] },
            { ColData: [{ value: "Depreciation Expense" }, { value: "12000.00" }] },
            { ColData: [{ value: "Interest Expense" }, { value: "8200.00" }] },
            { ColData: [{ value: "Interest Income" }, { value: "-450.00" }] },
          ],
        },
        Summary: { ColData: [{ value: "Total Expenses" }, { value: "370600.00" }] },
      },
      {
        type: "Section",
        group: "NetIncome",
        Summary: { ColData: [{ value: "Net Income" }, { value: "180700.00" }] },
      },
    ],
  },
};

describe("QuickBooks report parsing", () => {
  it("reads amounts the way Intuit writes them", () => {
    expect(parseAmount("1234.56")).toBe(1234.56);
    expect(parseAmount("$1,234.56")).toBe(1234.56);
    expect(parseAmount("-1,234.56")).toBe(-1234.56);
    // Accounting parentheses are a negative, not a parse failure.
    expect(parseAmount("(1,234.56)")).toBe(-1234.56);
    // A blank cell is ABSENT, not zero. This distinction is the whole design.
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
  });

  it("pulls section totals from group, not from the display label", () => {
    const parsed = parseProfitAndLoss(PL);
    expect(parsed.totalIncome).toBe(551300);
    expect(parsed.totalExpenses).toBe(370600);
    expect(parsed.netIncome).toBe(180700);
    expect(parsed.periodStart).toBe("2026-01-01");
    expect(parsed.periodEnd).toBe("2026-08-31");
  });

  it("sums labour across nested sub-accounts", () => {
    // 236000 + 18400. Summed from the LEAVES, not from the "Total Payroll
    // Expenses" summary -- so a chart of accounts that nests payroll two levels
    // deeper still adds up, and one that has no payroll section at all still
    // finds "Salaries & Wages" wherever it sits.
    expect(parseProfitAndLoss(PL).laborExpense).toBe(254400);
  });

  it("counts a contractor account nested under a payroll section", () => {
    // The Academy HS's real chart of accounts, 7 September 2026. The leaf
    // carries NO payroll word -- HS pays independent contractors by Zelle
    // rather than running a W-2 payroll -- and leaf-name matching alone
    // reported NULL labour cost for a school whose contractors are 94% of its
    // total spend. The section above it is what says "payroll".
    const hs: QboReport = {
      Rows: {
        Row: [
          {
            type: "Section",
            group: "Expenses",
            Rows: {
              Row: [
                {
                  type: "Section",
                  Header: { ColData: [{ value: "66000 Payroll Expenses" }] },
                  Rows: {
                    Row: [
                      {
                        type: "Section",
                        Header: { ColData: [{ value: "66100 Payroll Wages" }] },
                        Rows: {
                          Row: [
                            {
                              ColData: [
                                { value: "66150 Independent Contractor Payment" },
                                { value: "45561.95" },
                              ],
                            },
                          ],
                        },
                        Summary: {
                          ColData: [
                            { value: "Total 66100 Payroll Wages" },
                            { value: "45561.95" },
                          ],
                        },
                      },
                    ],
                  },
                  Summary: {
                    ColData: [
                      { value: "Total 66000 Payroll Expenses" },
                      { value: "45561.95" },
                    ],
                  },
                },
                { ColData: [{ value: "Software Subscriptions" }, { value: "3163.10" }] },
              ],
            },
            Summary: { ColData: [{ value: "Total Expenses" }, { value: "48725.05" }] },
          },
        ],
      },
    };

    // 45561.95 exactly -- ONCE. Two enclosing sections each carry the same
    // subtotal, so counting summaries as well as leaves would have reported
    // three times the real figure and looked entirely plausible.
    expect(parseProfitAndLoss(hs).laborExpense).toBe(45561.95);
    expect(parseProfitAndLoss(hs).totalExpenses).toBe(48725.05);
  });

  it("does not mistake interest income for interest expense", () => {
    expect(parseProfitAndLoss(PL).interestExpense).toBe(8200);
  });

  it("returns null for a figure that is absent, never zero", () => {
    const parsed = parseProfitAndLoss(PL);
    // There is no amortization account in these books. Saying 0 would assert
    // that amortization was zero; null says we did not find it. EBITDA treats
    // those differently.
    expect(parsed.amortization).toBeNull();
    expect(parsed.totalCogs).toBeNull();
    expect(sumMatchingAccounts(PL, [/nothing matches this/i])).toBeNull();
  });

  it("takes cash from the bank section, not from account names", () => {
    const bs: QboReport = {
      Rows: {
        Row: [
          {
            type: "Section",
            group: "BankAccounts",
            Rows: {
              Row: [
                { ColData: [{ value: "BofA Operating" }, { value: "184300.00" }] },
                { ColData: [{ value: "BofA Reserve" }, { value: "50000.00" }] },
              ],
            },
            Summary: { ColData: [{ value: "Total Bank Accounts" }, { value: "234300.00" }] },
          },
          {
            type: "Section",
            group: "OtherCurrentAssets",
            Rows: { Row: [{ ColData: [{ value: "Petty Cash Fund" }, { value: "900.00" }] }] },
            Summary: { ColData: [{ value: "Total Other" }, { value: "900.00" }] },
          },
        ],
      },
    };
    // 234300, not 235200 -- "Petty Cash Fund" matches the word cash but is not
    // a bank account, and name matching would have swept it in.
    expect(parseBalanceSheetCash(bs)).toBe(234300);
    expect(parseBalanceSheetCash({ Rows: { Row: [] } })).toBeNull();
  });

  it("survives a report shape it has never seen", () => {
    expect(parseProfitAndLoss({})).toMatchObject({
      totalIncome: null,
      totalExpenses: null,
      netIncome: null,
      laborExpense: null,
    });
  });
});
