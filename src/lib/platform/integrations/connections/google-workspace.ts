/**
 * RC-2.01 — Google Workspace OAuth connection lifecycle (DB-backed).
 */

import type { createAuthClient } from "@/lib/supabase/server-auth";
import {
  decryptCredentialSecret,
  encryptCredentialSecret,
} from "@/lib/integration-hub/vault-crypto";
import {
  buildGoogleWorkspaceAuthorizeUrl,
  googleWorkspaceOAuthConfig,
} from "@/lib/platform/integrations/connectors/google-workspace/auth";
import {
  createSignedOAuthState,
  parseSignedOAuthState,
} from "@/lib/platform/integrations/core/oauth-state";
import type {
  GoogleWorkspaceConnectionStatus,
  IntegrationConnectionHealth,
  IntegrationConnectionRow,
  IntegrationConnectionStatus,
} from "@/lib/platform/integrations/connections/types";
import { getGoogleWorkspaceSyncProgress } from "@/lib/platform/integrations/google-workspace/sync/progress";
import { GOOGLE_WORKSPACE_PROVIDER_VERSION } from "@/lib/platform/integrations/google-workspace/sync/instance-id";
import { resolvePublicAppOrigin } from "@/lib/platform/branding/public-origin";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export const GOOGLE_WORKSPACE_PROVIDER = "google_workspace" as const;

const EMPTY_SYNC_FIELDS = {
  currentSyncStatus: "idle" as const,
  recordsImported: 0,
  recordsChanged: 0,
  lastSyncDurationMs: null as number | null,
  nextScheduledSyncAt: null as string | null,
  nextFullSyncAt: null as string | null,
  consecutiveFailures: 0,
  errorDetails: null as string | null,
  providerVersion: null as string | null,
};

function appBaseUrl(): string {
  return resolvePublicAppOrigin();
}

export function googleWorkspaceRedirectUri(): string {
  return `${appBaseUrl()}/api/integrations/google/callback`;
}

export function googleWorkspaceClientConfig(): {
  clientId: string;
  clientSecret: string;
  configured: boolean;
} {
  const clientId =
    process.env.GOOGLE_WORKSPACE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    "";
  const clientSecret =
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    "";
  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
  };
}

function deriveHealth(input: {
  status: IntegrationConnectionStatus;
  expiresAt: string | null;
  lastSyncStatus: string | null;
  lastSuccessfulSyncAt: string | null;
  consecutiveFailures: number;
  errorDetails: string | null;
}): { health: IntegrationConnectionHealth; healthLabel: string } {
  if (input.status === "disconnected") {
    return { health: "disconnected", healthLabel: "Disconnected" };
  }
  if (input.status === "error") {
    return { health: "error", healthLabel: "Connection error" };
  }
  if (input.status === "pending") {
    return { health: "warning", healthLabel: "Pending" };
  }

  const expiresMs = input.expiresAt ? new Date(input.expiresAt).getTime() : null;
  const now = Date.now();
  if (expiresMs != null && (Number.isNaN(expiresMs) || expiresMs <= now)) {
    return { health: "error", healthLabel: "Token expired" };
  }
  if (input.consecutiveFailures >= 3 || input.lastSyncStatus === "failed") {
    return {
      health: "error",
      healthLabel: input.errorDetails ? "Sync failed" : "Sync error",
    };
  }
  if (expiresMs != null && expiresMs - now < 15 * 60 * 1000) {
    return { health: "warning", healthLabel: "Token expiring soon" };
  }
  if (input.consecutiveFailures > 0) {
    return { health: "warning", healthLabel: "Recent sync failures" };
  }
  if (!input.lastSuccessfulSyncAt) {
    return { health: "warning", healthLabel: "Awaiting first sync" };
  }
  const lastSuccessMs = new Date(input.lastSuccessfulSyncAt).getTime();
  if (!Number.isNaN(lastSuccessMs) && now - lastSuccessMs > 36 * 60 * 60 * 1000) {
    return { health: "warning", healthLabel: "Sync stale" };
  }
  return { health: "healthy", healthLabel: "Healthy" };
}

function toPublicStatus(
  row: IntegrationConnectionRow | null,
  sync?: {
    currentSyncStatus: GoogleWorkspaceConnectionStatus["currentSyncStatus"];
    lastSuccessfulSyncAt: string | null;
    recordsImported: number;
    recordsChanged: number;
    lastSyncDurationMs: number | null;
    nextScheduledSyncAt: string | null;
    nextFullSyncAt: string | null;
    consecutiveFailures: number;
    errorDetails: string | null;
    providerVersion: string | null;
  }
): GoogleWorkspaceConnectionStatus {
  if (!row) {
    return {
      provider: GOOGLE_WORKSPACE_PROVIDER,
      status: "disconnected",
      connected: false,
      health: "disconnected",
      healthLabel: "Disconnected",
      lastSyncAt: null,
      expiresAt: null,
      connectedAt: null,
      connectionId: null,
      ...EMPTY_SYNC_FIELDS,
    };
  }

  const lastSuccessfulSyncAt =
    sync?.lastSuccessfulSyncAt ??
    (row.last_sync_status === "succeeded" ? row.last_sync_at ?? null : null);
  const consecutiveFailures = sync?.consecutiveFailures ?? 0;
  const errorDetails = sync?.errorDetails ?? row.last_sync_error ?? null;
  const { health, healthLabel } = deriveHealth({
    status: row.status,
    expiresAt: row.expires_at,
    lastSyncStatus: row.last_sync_status ?? null,
    lastSuccessfulSyncAt,
    consecutiveFailures,
    errorDetails,
  });

  return {
    provider: GOOGLE_WORKSPACE_PROVIDER,
    status: row.status,
    connected: row.status === "connected",
    health,
    healthLabel,
    lastSyncAt: lastSuccessfulSyncAt ?? row.last_sync_at ?? null,
    expiresAt: row.expires_at,
    connectedAt: row.status === "connected" ? row.updated_at : null,
    connectionId: row.id,
    currentSyncStatus: sync?.currentSyncStatus ?? "idle",
    recordsImported: sync?.recordsImported ?? row.records_imported ?? 0,
    recordsChanged: sync?.recordsChanged ?? row.last_sync_records ?? 0,
    lastSyncDurationMs:
      sync?.lastSyncDurationMs ?? row.last_sync_duration_ms ?? null,
    nextScheduledSyncAt: sync?.nextScheduledSyncAt ?? null,
    nextFullSyncAt: sync?.nextFullSyncAt ?? null,
    consecutiveFailures,
    errorDetails,
    providerVersion: sync?.providerVersion ?? GOOGLE_WORKSPACE_PROVIDER_VERSION,
  };
}

export async function getGoogleWorkspaceConnection(
  supabase: AuthClient,
  organizationId: string
): Promise<IntegrationConnectionRow | null> {
  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", GOOGLE_WORKSPACE_PROVIDER)
    .maybeSingle();

  if (error) {
    console.error("[integrations/google] get connection failed", error.message);
    return null;
  }
  return (data as IntegrationConnectionRow | null) ?? null;
}

export async function getGoogleWorkspaceStatus(
  supabase: AuthClient,
  organizationId: string
): Promise<GoogleWorkspaceConnectionStatus> {
  const row = await getGoogleWorkspaceConnection(supabase, organizationId);
  if (!row) return toPublicStatus(null);

  const progress = await getGoogleWorkspaceSyncProgress(supabase, organizationId);
  return toPublicStatus(row, {
    currentSyncStatus: progress.currentStatus,
    lastSuccessfulSyncAt: progress.lastSuccessfulSyncAt,
    recordsImported: progress.recordsImported,
    recordsChanged: progress.recordsChanged,
    lastSyncDurationMs: progress.lastSyncDurationMs,
    nextScheduledSyncAt: progress.nextScheduledSyncAt,
    nextFullSyncAt: progress.nextFullSyncAt,
    consecutiveFailures: progress.consecutiveFailures,
    errorDetails: progress.errorDetails,
    providerVersion: progress.providerVersion,
  });
}

/**
 * @param mode "org" (default) for the single organisation-wide grant;
 *   "user" for one staff member connecting their own account. Both use the SAME
 *   redirect URI — the mode travels in the signed state — so adding the
 *   per-user flow required no new registration in Google Cloud.
 */
export function buildGoogleConnectAuthorizeUrl(input: {
  organizationId: string;
  userId: string;
  mode?: "org" | "user";
}): { authorizeUrl: string; state: string } | { error: string } {
  const { clientId, clientSecret, configured } = googleWorkspaceClientConfig();
  if (!configured) {
    return {
      error:
        "Google Workspace OAuth is not configured. Set GOOGLE_WORKSPACE_CLIENT_ID and GOOGLE_WORKSPACE_CLIENT_SECRET.",
    };
  }

  const mode = input.mode ?? "org";

  const state = createSignedOAuthState("gw", {
    organizationId: input.organizationId,
    userId: input.userId,
    mode,
  });

  // adminConsent only for the org grant. A teacher connecting their own mailbox
  // is not consenting on the domain's behalf and must not be asked to.
  const adminConsent = mode === "org";

  // The scope list follows `mode`, not just the consent prompt. The org grant
  // stays metadata-only because it reaches every mailbox in the domain; the
  // per-user grant carries gmail.readonly, calendar and drive.readonly because
  // it reaches exactly one person's, with their own consent and their own
  // revocation. See GOOGLE_USER_OAUTH_SCOPES for the full reasoning.
  const oauth = googleWorkspaceOAuthConfig({
    clientId,
    clientSecret,
    redirectUri: googleWorkspaceRedirectUri(),
    adminConsent,
    mode,
  });

  const authorizeUrl = buildGoogleWorkspaceAuthorizeUrl(oauth, {
    state,
    adminConsent,
  });

  return { authorizeUrl, state };
}

export function parseGoogleOAuthState(state: string): {
  organizationId: string;
  userId: string;
  mode: "org" | "user";
} | null {
  const claims = parseSignedOAuthState("gw", state);
  if (!claims) return null;
  return {
    organizationId: claims.organizationId,
    userId: claims.userId,
    // Absent means org — states issued before the per-user flow existed still
    // parse, and default to the behaviour they were issued for.
    mode: claims.mode === "user" ? "user" : "org",
  };
}

export async function exchangeGoogleAuthorizationCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  /**
   * WHAT GOOGLE ACTUALLY GRANTED, from the token response's `scope` field.
   *
   * Google may grant a subset of what was requested — the user can decline
   * individual permissions on the consent screen. This was previously parsed
   * and thrown away, which meant a feature needing gmail.readonly and given
   * only gmail.metadata would return an empty result indistinguishable from an
   * empty inbox. Store it; let features check it and say "reconnect to enable
   * this" instead.
   */
  grantedScopes: string[];
} | { error: string }> {
  const { clientId, clientSecret, configured } = googleWorkspaceClientConfig();
  if (!configured) {
    return { error: "Google Workspace OAuth is not configured." };
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: googleWorkspaceRedirectUri(),
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    return {
      error: json.error_description || json.error || "Token exchange failed",
    };
  }

  const expiresAt = new Date(
    Date.now() + (json.expires_in ?? 3600) * 1000
  ).toISOString();

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? "",
    expiresAt,
    grantedScopes: (json.scope ?? "").split(" ").filter(Boolean),
  };
}

export async function upsertGoogleWorkspaceConnection(
  supabase: AuthClient,
  input: {
    organizationId: string;
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    status?: IntegrationConnectionStatus;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const payload = {
    organization_id: input.organizationId,
    provider: GOOGLE_WORKSPACE_PROVIDER,
    status: input.status ?? "connected",
    access_token: encryptCredentialSecret(input.accessToken),
    refresh_token: input.refreshToken
      ? encryptCredentialSecret(input.refreshToken)
      : null,
    expires_at: input.expiresAt,
    connected_by: input.userId,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("integration_connections")
    .upsert(payload, { onConflict: "organization_id,provider" })
    .select("id")
    .single();

  if (error) {
    console.error("[integrations/google] upsert failed", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

/** Local/dev connect without Google app credentials — still writes a real DB row. */
export async function connectGoogleWorkspaceDemo(
  supabase: AuthClient,
  input: { organizationId: string; userId: string }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const result = await upsertGoogleWorkspaceConnection(supabase, {
    organizationId: input.organizationId,
    userId: input.userId,
    accessToken: "demo-google-workspace-access-token",
    refreshToken: "demo-google-workspace-refresh-token",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    status: "connected",
  });
  if (result.ok) {
    const { ensureSyncRegistry } = await import(
      "@/lib/platform/integrations/google-workspace/sync/registry-store"
    );
    await ensureSyncRegistry(supabase, result.id, input.organizationId);
  }
  return result;
}

export async function disconnectGoogleWorkspace(
  supabase: AuthClient,
  organizationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("integration_connections")
    .upsert(
      {
        organization_id: organizationId,
        provider: GOOGLE_WORKSPACE_PROVIDER,
        status: "disconnected",
        access_token: null,
        refresh_token: null,
        expires_at: null,
        updated_at: now,
      },
      { onConflict: "organization_id,provider" }
    );

  if (error) {
    console.error("[integrations/google] disconnect failed", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export function readStoredAccessToken(row: IntegrationConnectionRow): string | null {
  if (!row.access_token) return null;
  return decryptCredentialSecret(row.access_token) ?? row.access_token;
}
