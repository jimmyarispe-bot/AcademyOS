/**
 * Ask Intuit what each connected company file is actually called.
 *
 * WHY THIS IS NOT COSMETIC. A connection is identified by its realmId, a
 * meaningless number chosen on Intuit's own company picker. The callback stores
 * `QuickBooks Company 9341454758261258` as a placeholder because Intuit's token
 * response carries no company name. Seven books connected on 7 September looked
 * exactly alike, and mapping one of them to The Academy GA would have been a
 * coin flip -- with the losing outcome being one entity's financials filed
 * under another, displayed with full confidence.
 *
 * The CompanyInfo endpoint is also the cheapest possible proof that a stored
 * token actually works against Intuit's API. A token that decrypts and refreshes
 * is not the same as a token Intuit accepts.
 */

import { createServiceRoleClient } from "@/lib/supabase/server";
import { quickbooksClientConfig } from "@/lib/connectors/quickbooks/config";
import {
  ensureQuickBooksAccessToken,
  listQuickBooksConnections,
} from "@/lib/connectors/quickbooks/persistence";

type LooseClient = {
  from: (table: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

function apiBase(): string {
  return quickbooksClientConfig().environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export type CompanyNameResult = {
  realmId: string;
  before: string | null;
  after: string | null;
  legalName: string | null;
  ok: boolean;
  error?: string;
};

/**
 * Fill in the real company name for every connection an organisation holds.
 *
 * One book failing does not stop the others: each result carries its own
 * outcome, so a run that half works says which half.
 */
export async function refreshQuickBooksCompanyNames(
  organizationId: string
): Promise<CompanyNameResult[]> {
  const connections = await listQuickBooksConnections(organizationId);
  const results: CompanyNameResult[] = [];

  for (const conn of connections) {
    if (conn.status === "disconnected") continue;

    const token = await ensureQuickBooksAccessToken(organizationId, conn.realm_id);
    if (!token.ok) {
      results.push({
        realmId: conn.realm_id,
        before: conn.company_name,
        after: conn.company_name,
        legalName: null,
        ok: false,
        error: token.error,
      });
      continue;
    }

    const url =
      `${apiBase()}/v3/company/${encodeURIComponent(conn.realm_id)}` +
      `/companyinfo/${encodeURIComponent(conn.realm_id)}?minorversion=70`;

    let name: string | null = null;
    let legalName: string | null = null;
    let failure: string | null = null;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: "application/json",
        },
      });
      const text = await response.text();
      if (!response.ok) {
        // Intuit's error bodies are verbose and the useful part is early.
        failure = `HTTP ${response.status}: ${text.slice(0, 200)}`;
      } else {
        const json = JSON.parse(text) as {
          CompanyInfo?: { CompanyName?: string; LegalName?: string };
        };
        name = json.CompanyInfo?.CompanyName?.trim() || null;
        legalName = json.CompanyInfo?.LegalName?.trim() || null;
      }
    } catch (err) {
      failure = err instanceof Error ? err.message : "CompanyInfo request failed";
    }

    if (failure || !name) {
      results.push({
        realmId: conn.realm_id,
        before: conn.company_name,
        after: conn.company_name,
        legalName,
        ok: false,
        error: failure ?? "Intuit returned no company name.",
      });
      continue;
    }

    const { error } = await (
      createServiceRoleClient() as unknown as LooseClient
    )
      .from("fi_quickbooks_connections")
      .update({ company_name: name, updated_at: new Date().toISOString() })
      .eq("id", conn.id);

    results.push({
      realmId: conn.realm_id,
      before: conn.company_name,
      after: error ? conn.company_name : name,
      legalName,
      ok: !error,
      ...(error ? { error: error.message } : {}),
    });
  }

  return results;
}
