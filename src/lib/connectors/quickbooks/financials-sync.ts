/**
 * Pull each mapped company file's P&L and cash position, and store it.
 *
 * ONLY MAPPED BOOKS. A connection still 'unassigned' is one nobody has
 * confirmed belongs to an entity -- on 7 September that was The Academy NJ and
 * a duplicate holding-company file. Syncing those would put figures in the
 * table with nowhere to belong, and the first consolidation that summed the
 * table instead of joining it would silently double-count the network.
 *
 * ONE BOOK'S FAILURE DOES NOT STOP THE OTHERS. Each result carries its own
 * outcome, so a partial run says which part.
 */

import { createServiceRoleClient } from "@/lib/supabase/server";
import { quickbooksClientConfig } from "@/lib/connectors/quickbooks/config";
import {
  ensureQuickBooksAccessToken,
  listQuickBooksConnections,
  type QboConnectionRow,
} from "@/lib/connectors/quickbooks/persistence";
import {
  parseProfitAndLoss,
  parseBalanceSheetCash,
  type QboReport,
  type ParsedProfitAndLoss,
} from "@/lib/connectors/quickbooks/reports-parse";

type LooseClient = {
  from: (table: string) => {
    upsert: (
      row: Record<string, unknown>,
      options: { onConflict: string }
    ) => {
      select: (columns: string) => {
        single: () => PromiseLike<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

function apiBase(): string {
  return quickbooksClientConfig().environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

/** Calendar year to date, in the books' own terms. */
export function defaultPeriod(now = new Date()): { start: string; end: string } {
  const year = now.getUTCFullYear();
  return {
    start: `${year}-01-01`,
    end: now.toISOString().slice(0, 10),
  };
}

async function fetchReport(
  realmId: string,
  accessToken: string,
  report: "ProfitAndLoss" | "BalanceSheet",
  params: Record<string, string>
): Promise<{ ok: true; report: QboReport } | { ok: false; error: string }> {
  const url = new URL(
    `${apiBase()}/v3/company/${encodeURIComponent(realmId)}/reports/${report}`
  );
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("minorversion", "70");

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, report: JSON.parse(text) as QboReport };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : `${report} request failed`,
    };
  }
}

export type FinancialsSyncResult = {
  realmId: string;
  companyName: string | null;
  scope: string;
  ok: boolean;
  error?: string;
  figures?: ParsedProfitAndLoss & { cashBalance: number | null };
  /** Named so a half-parsed report is visible rather than quietly incomplete. */
  missing?: string[];
};

async function syncOne(
  organizationId: string,
  conn: QboConnectionRow,
  period: { start: string; end: string }
): Promise<FinancialsSyncResult> {
  const base = {
    realmId: conn.realm_id,
    companyName: conn.company_name,
    scope: conn.scope,
  };

  const token = await ensureQuickBooksAccessToken(organizationId, conn.realm_id);
  if (!token.ok) return { ...base, ok: false, error: token.error };

  const pl = await fetchReport(conn.realm_id, token.accessToken, "ProfitAndLoss", {
    start_date: period.start,
    end_date: period.end,
    accounting_method: "Accrual",
  });
  if (!pl.ok) return { ...base, ok: false, error: `P&L: ${pl.error}` };

  const bs = await fetchReport(conn.realm_id, token.accessToken, "BalanceSheet", {
    as_of: period.end,
    accounting_method: "Accrual",
  });

  const figures = parseProfitAndLoss(pl.report);
  const cashBalance = bs.ok ? parseBalanceSheetCash(bs.report) : null;

  // Say which figures Intuit's report did not yield. A caller that sees
  // payrollExpense in this list knows EBITDA cannot be trusted, rather than
  // reading a null as a zero.
  const missing = Object.entries({ ...figures, cashBalance })
    .filter(([key, value]) => value === null && !key.startsWith("period"))
    .map(([key]) => key);

  const now = new Date().toISOString();
  const { error } = await (createServiceRoleClient() as unknown as LooseClient)
    .from("fi_quickbooks_financials")
    .upsert(
      {
        connection_id: conn.id,
        organization_id: organizationId,
        school_id: conn.school_id,
        scope: conn.scope,
        period_start: period.start,
        period_end: period.end,
        total_income: figures.totalIncome,
        total_cogs: figures.totalCogs,
        total_expenses: figures.totalExpenses,
        net_income: figures.netIncome,
        payroll_expense: figures.payrollExpense,
        depreciation: figures.depreciation,
        amortization: figures.amortization,
        interest_expense: figures.interestExpense,
        cash_balance: cashBalance,
        cash_as_of: bs.ok ? period.end : null,
        raw_profit_and_loss: pl.report,
        raw_balance_sheet: bs.ok ? bs.report : null,
        fetched_at: now,
        updated_at: now,
      },
      { onConflict: "connection_id,period_start,period_end" }
    )
    .select("id")
    .single();

  if (error) {
    return { ...base, ok: false, error: `Could not store: ${error.message}` };
  }

  return {
    ...base,
    ok: true,
    figures: { ...figures, cashBalance },
    ...(missing.length ? { missing } : {}),
  };
}

export async function syncQuickBooksFinancials(
  organizationId: string,
  period = defaultPeriod()
): Promise<FinancialsSyncResult[]> {
  const connections = await listQuickBooksConnections(organizationId);
  const results: FinancialsSyncResult[] = [];

  for (const conn of connections) {
    if (conn.status !== "connected") continue;
    if (conn.scope !== "school" && conn.scope !== "network") continue;
    results.push(await syncOne(organizationId, conn, period));
  }

  return results;
}
