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

  it("counts ADP and Zelle labour accounts, each exactly once", () => {
    // How this network actually pays people: ADP for FL and GA's W-2 payroll,
    // Zelle for HS and Virtual's independent contractors.
    const books: QboReport = {
      Rows: {
        Row: [
          {
            type: "Section",
            group: "Expenses",
            Rows: {
              Row: [
                { ColData: [{ value: "ADP Payroll Fees" }, { value: "1240.00" }] },
                { ColData: [{ value: "Zelle - Contractor Payments" }, { value: "8300.00" }] },
                { ColData: [{ value: "Rent" }, { value: "5000.00" }] },
              ],
            },
            Summary: { ColData: [{ value: "Total Expenses" }, { value: "14540.00" }] },
          },
        ],
      },
    };
    expect(parseProfitAndLoss(books).laborExpense).toBe(9540);

    // AND THE FAILURE MODE THAT MATTERS. Zelle is a payment method, not a
    // category. If a book has BOTH a Zelle bank/clearing account and the
    // contractor expense account the money is categorised into, matching both
    // counts the same dollars twice -- and 91,123.90 would look every bit as
    // plausible on a dashboard as 45,561.95.
    //
    // The guard is that labour is only ever summed from the EXPENSE sections.
    // A bank account is not a cost, whatever it is named. Written first as a
    // leaves-only claim, which was wrong -- this test returned 91,123.90 and
    // sent the fix back for the scoping it actually needed.
    const withClearing: QboReport = {
      Rows: {
        Row: [
          {
            type: "Section",
            group: "Expenses",
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
            Summary: { ColData: [{ value: "Total Expenses" }, { value: "45561.95" }] },
          },
          {
            type: "Section",
            group: "BankAccounts",
            Rows: {
              Row: [
                { ColData: [{ value: "Zelle Clearing" }, { value: "45561.95" }] },
              ],
            },
            Summary: { ColData: [{ value: "Total Bank" }, { value: "45561.95" }] },
          },
        ],
      },
    };
    // 45,561.95 -- not 91,123.90.
    expect(parseProfitAndLoss(withClearing).laborExpense).toBe(45561.95);
  });

  it("counts an account that has both its own postings and sub-accounts", () => {
    // The Academy FL's real payroll section, 7 September 2026. 66000 has its
    // OWN transactions (75,213.22) as well as three sub-accounts. QuickBooks
    // renders that as a section whose HEADER carries the parent's money.
    //
    // Skipping every row with children -- the rule that correctly prevents
    // double-counting summaries -- silently dropped it. FL's labour read
    // 72,251.20 against a true 147,464.42, and GA's read 24,641.74 against
    // 120,392.34. An UNDER-count of roughly half, in the two entities that
    // looked cleanest, on a figure that feeds EBITDA.
    //
    // Nine tests passed through that bug. This is the one that would not have.
    const fl: QboReport = {
      Rows: {
        Row: [
          {
            type: "Section",
            group: "Expenses",
            Rows: {
              Row: [
                {
                  type: "Section",
                  Header: {
                    ColData: [
                      { value: "66000 Payroll Expenses" },
                      { value: "75213.22" },
                    ],
                  },
                  Rows: {
                    Row: [
                      { ColData: [{ value: "66300 Payroll Fees" }, { value: "31566.45" }] },
                      { ColData: [{ value: "66100 Payroll Wages" }, { value: "26330.40" }] },
                      { ColData: [{ value: "66200 Payroll Taxes" }, { value: "14354.35" }] },
                    ],
                  },
                  Summary: {
                    ColData: [
                      { value: "Total 66000 Payroll Expenses" },
                      { value: "147464.42" },
                    ],
                  },
                },
              ],
            },
            Summary: { ColData: [{ value: "Total Expenses" }, { value: "197074.06" }] },
          },
        ],
      },
    };

    // Header 75,213.22 + three leaves 72,251.20 = 147,464.42, which is exactly
    // what QuickBooks prints as the section total. Matching it proves both
    // halves at once: the header is counted, and the Summary is not.
    expect(parseProfitAndLoss(fl).laborExpense).toBe(147464.42);
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
