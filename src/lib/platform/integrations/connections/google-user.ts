/**
 * Per-user Google connections — one staff member's own account.
 *
 * WHY THIS EXISTS SEPARATELY FROM google-workspace.ts.
 *
 * `integration_connections` holds ONE grant for the whole organisation. That is
 * right for organisational reads: the directory, the Classroom catalogue. It is
 * wrong for personal surfaces. "Show me my inbox" has exactly one correct
 * answer per person, and it is not "whatever account the founder connected".
 *
 * So: one row per user in `user_google_connections` (migration 300), each with
 * their own encrypted tokens and their own refresh cycle. A person disconnecting
 * breaks only their own view.
 *
 * REJECTED: domain-wide delegation. It would let JAG read every staff member's
 * mail without their individual consent, with no way for an individual to
 * revoke. Same result for the user, vastly more concentrated risk.
 *
 * WRITES GO THROUGH THE SERVICE ROLE. The table has a read-your-own-row policy
 * and NO write policy, deliberately — see migration 300. supabase-js does not
 * throw on an RLS refusal, it resolves with { error }, so every write here
 * checks the returned error rather than relying on try/catch.
 */

import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  encryptCredentialSecret,
  decryptCredentialSecret,
} from "@/lib/integration-hub/vault-crypto";
import { googleWorkspaceClientConfig } from "@/lib/platform/integrations/connections/google-workspace";

/** Untyped on purpose: user_google_connections is not in database.ts yet. */
type LooseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        maybeSingle: () => PromiseLike<{
          data: UserGoogleConnectionRow | null;
          error: { message: string } | null;
        }>;
      };
    };
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
    update: (row: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export interface UserGoogleConnectionRow {
  id: string;
  user_id: string;
  organization_id: string;
  google_email: string | null;
  status: "pending" | "connected" | "disconnected" | "error";
  granted_scopes: string[] | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  last_error: string | null;
}

function serviceClient(): LooseClient {
  return createServiceRoleClient() as unknown as LooseClient;
}

export async function getUserGoogleConnection(
  userId: string
): Promise<UserGoogleConnectionRow | null> {
  const { data, error } = await serviceClient()
    .from("user_google_connections")
    .select(
      "id, user_id, organization_id, google_email, status, granted_scopes, access_token, refresh_token, expires_at, last_error"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[google-user] read failed", { userId, error: error.message });
    return null;
  }
  return data;
}

export async function saveUserGoogleConnection(input: {
  userId: string;
  organizationId: string;
  googleEmail: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  grantedScopes: string[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const now = new Date().toISOString();

  // A refresh token is only returned on FIRST consent, or when prompt=consent
  // forces a fresh one. On a re-connect Google may send none — in that case keep
  // the one already stored rather than writing an empty string and turning a
  // working connection into a dead one.
  const existing = await getUserGoogleConnection(input.userId);
  const refreshToken = input.refreshToken
    ? encryptCredentialSecret(input.refreshToken)
    : existing?.refresh_token ?? null;

  if (!refreshToken) {
    return {
      ok: false,
      error:
        "Google returned no refresh token and none was stored. Disconnect and reconnect to force a fresh consent.",
    };
  }

  const { data, error } = await serviceClient()
    .from("user_google_connections")
    .upsert(
      {
        user_id: input.userId,
        organization_id: input.organizationId,
        google_email: input.googleEmail,
        status: "connected",
        granted_scopes: input.grantedScopes,
        access_token: encryptCredentialSecret(input.accessToken),
        refresh_token: refreshToken,
        expires_at: input.expiresAt,
        connected_at: now,
        last_error: null,
        updated_at: now,
      },
      { onConflict: "user_id" }
    )
    .select("id")
    .single();

  if (error || !data) {
    console.error("[google-user] save failed", {
      userId: input.userId,
      error: error?.message,
    });
    return { ok: false, error: error?.message ?? "Could not save connection." };
  }
  return { ok: true, id: data.id };
}

async function markError(userId: string, message: string): Promise<void> {
  const { error } = await serviceClient()
    .from("user_google_connections")
    .update({
      status: "error",
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) {
    console.error("[google-user] could not record error", {
      userId,
      error: error.message,
    });
  }
}

function isExpired(expiresAt: string | null, skewMs = 60_000): boolean {
  if (!expiresAt) return true;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return true;
  return t <= Date.now() + skewMs;
}

/**
 * A usable access token for this user, refreshing if needed.
 *
 * Returns a REASON on failure rather than null, so a feature can tell the
 * person what to do — "reconnect Google" is actionable, an empty panel is not.
 */
export async function ensureUserGoogleAccessToken(
  userId: string
): Promise<
  | { ok: true; accessToken: string; grantedScopes: string[] }
  | { ok: false; error: string; needsReconnect: boolean }
> {
  const row = await getUserGoogleConnection(userId);
  if (!row) {
    return {
      ok: false,
      error: "You have not connected your Google account yet.",
      needsReconnect: true,
    };
  }
  if (row.status === "disconnected") {
    return {
      ok: false,
      error: "Your Google account is disconnected.",
      needsReconnect: true,
    };
  }

  const grantedScopes = row.granted_scopes ?? [];
  const accessToken = row.access_token
    ? decryptCredentialSecret(row.access_token) ?? row.access_token
    : null;
  const refreshToken = row.refresh_token
    ? decryptCredentialSecret(row.refresh_token) ?? row.refresh_token
    : null;

  if (accessToken && !isExpired(row.expires_at)) {
    return { ok: true, accessToken, grantedScopes };
  }

  if (!refreshToken) {
    await markError(userId, "No refresh token stored.");
    return {
      ok: false,
      error: "Your Google connection is incomplete. Reconnect to fix it.",
      needsReconnect: true,
    };
  }

  const { clientId, clientSecret, configured } = googleWorkspaceClientConfig();
  if (!configured) {
    return {
      ok: false,
      error: "Google OAuth is not configured on this deployment.",
      needsReconnect: false,
    };
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    // invalid_grant here means the person revoked access in their Google
    // account, or the token aged out. Either way reconnecting is the fix, and
    // saying so beats a generic failure.
    const revoked = json.error === "invalid_grant";
    const message = json.error_description || json.error || "Token refresh failed";
    await markError(userId, message);
    return {
      ok: false,
      error: revoked
        ? "Your Google access was revoked. Reconnect to restore it."
        : message,
      needsReconnect: true,
    };
  }

  const expiresAt = new Date(
    Date.now() + (json.expires_in ?? 3600) * 1000
  ).toISOString();
  const refreshedScopes = json.scope
    ? json.scope.split(" ").filter(Boolean)
    : grantedScopes;

  const { error } = await serviceClient()
    .from("user_google_connections")
    .update({
      access_token: encryptCredentialSecret(json.access_token),
      expires_at: expiresAt,
      granted_scopes: refreshedScopes,
      status: "connected",
      last_error: null,
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    // The token is good even though we failed to persist it. Use it for this
    // request rather than failing the person's page over a write.
    console.error("[google-user] refreshed but could not persist", {
      userId,
      error: error.message,
    });
  }

  return {
    ok: true,
    accessToken: json.access_token,
    grantedScopes: refreshedScopes,
  };
}

/**
 * Does this user's connection actually carry the scope a feature needs?
 *
 * The point of storing granted_scopes: Google can grant a subset, and a feature
 * that silently returns nothing is indistinguishable from one with no data.
 */
export function hasScope(grantedScopes: string[], scope: string): boolean {
  return grantedScopes.includes(scope);
}
