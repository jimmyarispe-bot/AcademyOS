/**
 * Persisted QuickBooks connections — five company files, in Postgres.
 *
 * WHAT THIS REPLACES. `lib/connectors/store.ts` keeps installations and
 * credentials in `globalThis.__jagConnectorStore`: in memory, per lambda
 * instance, gone on the next cold start. On 7 September all five books were
 * authorised through Intuit successfully and `fi_quickbooks_connections` still
 * held zero rows, because nothing ever wrote there — the tokens went into RAM
 * that no longer exists. A connect flow that reports success and stores nothing
 * durable is the same fault as the demo-mode Connect button, one layer down.
 *
 * SERVICE ROLE, AND THE ERROR IS CHECKED. Migration 298 gives this table a read
 * policy for authenticated users and NO write policy, deliberately. supabase-js
 * does not throw on an RLS refusal — it resolves with { error } — so a write
 * made with a cookie client would be silently dropped and the table would look
 * exactly as it does now. Every write here goes through the service role and
 * inspects the returned error.
 *
 * TOKENS ARE CIPHERTEXT. Nothing in this module puts a raw Intuit token in a
 * column.
 */

import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  encryptCredentialSecret,
  decryptCredentialSecret,
} from "@/lib/integration-hub/vault-crypto";
import { refreshQuickBooksTokens } from "@/lib/connectors/quickbooks/oauth";
import type { QboTokenBundle } from "@/lib/connectors/quickbooks/types";

/** Untyped on purpose: fi_quickbooks_connections is not in database.ts yet. */
type LooseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        c: string,
        v: string
      ) => {
        eq: (
          c: string,
          v: string
        ) => {
          maybeSingle: () => PromiseLike<{
            data: QboConnectionRow | null;
            error: { message: string } | null;
          }>;
        };
        order: (
          c: string,
          o: { ascending: boolean }
        ) => PromiseLike<{
          data: QboConnectionRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
    insert: (row: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => PromiseLike<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export interface QboConnectionRow {
  id: string;
  organization_id: string;
  realm_id: string;
  company_name: string | null;
  scope: "school" | "network" | "unassigned";
  school_id: string | null;
  status: "pending" | "connected" | "disconnected" | "error";
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  refresh_token_expires_at: string | null;
  last_sync_at: string | null;
  last_sync_error: string | null;
}

const COLUMNS =
  "id, organization_id, realm_id, company_name, scope, school_id, status, " +
  "access_token, refresh_token, expires_at, refresh_token_expires_at, " +
  "last_sync_at, last_sync_error";

function db(): LooseClient {
  return createServiceRoleClient() as unknown as LooseClient;
}

export async function getQuickBooksConnection(
  organizationId: string,
  realmId: string
): Promise<QboConnectionRow | null> {
  const { data, error } = await db()
    .from("fi_quickbooks_connections")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .eq("realm_id", realmId)
    .maybeSingle();

  if (error) {
    console.error("[qbo] read connection failed", {
      organizationId,
      realmId,
      error: error.message,
    });
    return null;
  }
  return data;
}

export async function listQuickBooksConnections(
  organizationId: string
): Promise<QboConnectionRow[]> {
  const { data, error } = await db()
    .from("fi_quickbooks_connections")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .order("company_name", { ascending: true });

  if (error) {
    console.error("[qbo] list connections failed", {
      organizationId,
      error: error.message,
    });
    return [];
  }
  return data ?? [];
}

/**
 * Persist a freshly authorised book.
 *
 * READ-THEN-WRITE RATHER THAN UPSERT, on purpose. An upsert would have to name
 * every column including `scope`, and re-authorising a book that a person had
 * already mapped to The Academy GA would quietly reset it to 'unassigned'. The
 * mapping is the part a human checked; a reconnect must not undo it.
 *
 * A NEW book lands as 'unassigned' — JAG does not know which entity it is. The
 * realmId is chosen on INTUIT'S company picker, which JAG neither controls nor
 * sees; assuming it matches the button clicked in JAG would file one entity's
 * financials under another while looking entirely confident. See migration 299.
 */
export async function saveQuickBooksConnection(input: {
  organizationId: string;
  userId: string;
  tokens: QboTokenBundle & { refreshTokenExpiresAt?: string };
}): Promise<{ ok: true; id: string; created: boolean } | { ok: false; error: string }> {
  const { organizationId, userId, tokens } = input;
  const now = new Date().toISOString();

  const existing = await getQuickBooksConnection(organizationId, tokens.realmId);

  const secrets = {
    access_token: encryptCredentialSecret(tokens.accessToken),
    refresh_token: encryptCredentialSecret(tokens.refreshToken),
    expires_at: tokens.expiresAt,
    refresh_token_expires_at: tokens.refreshTokenExpiresAt ?? null,
    company_name: tokens.companyName,
    status: "connected" as const,
    last_sync_error: null,
    connected_by_user_id: userId,
    connected_at: now,
    updated_at: now,
  };

  if (existing) {
    const { error } = await db()
      .from("fi_quickbooks_connections")
      .update(secrets)
      .eq("id", existing.id);
    if (error) {
      console.error("[qbo] update connection failed", {
        realmId: tokens.realmId,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }
    return { ok: true, id: existing.id, created: false };
  }

  const { data, error } = await db()
    .from("fi_quickbooks_connections")
    .insert({
      organization_id: organizationId,
      realm_id: tokens.realmId,
      scope: "unassigned",
      school_id: null,
      ...secrets,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[qbo] insert connection failed", {
      realmId: tokens.realmId,
      error: error?.message,
    });
    return { ok: false, error: error?.message ?? "Could not save connection." };
  }
  return { ok: true, id: data.id, created: true };
}

async function markError(id: string, message: string): Promise<void> {
  // The status check constraint refuses 'error' with no reason, so the message
  // is not optional here even if it were tempting to leave it null.
  const { error } = await db()
    .from("fi_quickbooks_connections")
    .update({
      status: "error",
      last_sync_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[qbo] could not record error", { id, error: error.message });
  }
}

function isExpired(expiresAt: string | null, skewMs = 120_000): boolean {
  if (!expiresAt) return true;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return true;
  return t <= Date.now() + skewMs;
}

/**
 * A usable access token for one book, refreshing if needed.
 *
 * Intuit access tokens last an hour and refresh tokens roll on every use — the
 * NEW refresh token in the response must be stored or the next refresh fails
 * with invalid_grant, which reads like a revoked authorisation and is not one.
 */
export async function ensureQuickBooksAccessToken(
  organizationId: string,
  realmId: string
): Promise<
  | { ok: true; accessToken: string; row: QboConnectionRow }
  | { ok: false; error: string; needsReconnect: boolean }
> {
  const row = await getQuickBooksConnection(organizationId, realmId);
  if (!row) {
    return {
      ok: false,
      error: "This QuickBooks company is not connected.",
      needsReconnect: true,
    };
  }
  if (row.status === "disconnected") {
    return {
      ok: false,
      error: "This QuickBooks company was disconnected.",
      needsReconnect: true,
    };
  }

  const accessToken = row.access_token
    ? decryptCredentialSecret(row.access_token) ?? row.access_token
    : null;
  const refreshToken = row.refresh_token
    ? decryptCredentialSecret(row.refresh_token) ?? row.refresh_token
    : null;

  if (accessToken && !isExpired(row.expires_at)) {
    return { ok: true, accessToken, row };
  }

  if (!refreshToken) {
    await markError(row.id, "No refresh token stored.");
    return {
      ok: false,
      error: "This connection is incomplete. Reconnect it in QuickBooks.",
      needsReconnect: true,
    };
  }

  const refreshed = await refreshQuickBooksTokens(refreshToken);
  if (!refreshed.ok) {
    await markError(row.id, refreshed.error.message);
    return {
      ok: false,
      error: refreshed.error.message,
      needsReconnect: !refreshed.error.retryable,
    };
  }

  const now = new Date().toISOString();
  const { error } = await db()
    .from("fi_quickbooks_connections")
    .update({
      access_token: encryptCredentialSecret(refreshed.tokens.accessToken),
      refresh_token: encryptCredentialSecret(refreshed.tokens.refreshToken),
      expires_at: refreshed.tokens.expiresAt,
      status: "connected",
      last_sync_error: null,
      updated_at: now,
    })
    .eq("id", row.id);

  if (error) {
    // The token is good; only the write failed. Use it for this request rather
    // than failing the caller over persistence — but say so, because the next
    // refresh will now be using a rolled-over token we did not store.
    console.error("[qbo] refreshed but could not persist", {
      id: row.id,
      error: error.message,
    });
  }

  return { ok: true, accessToken: refreshed.tokens.accessToken, row };
}
