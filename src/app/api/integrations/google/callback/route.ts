import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { requireOrganizationAccess } from "@/lib/platform/identity/tenant-access";
import { logSecurityEvent } from "@/lib/platform/identity/security";
import {
  exchangeGoogleAuthorizationCode,
  parseGoogleOAuthState,
  upsertGoogleWorkspaceConnection,
} from "@/lib/platform/integrations/connections";

import { resolvePublicAppOrigin } from "@/lib/platform/branding";

function settingsRedirect(query: Record<string, string>): NextResponse {
  const base = resolvePublicAppOrigin();
  const url = new URL("/settings/integrations/google", base);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

async function guardIntegrations(supabase: Awaited<ReturnType<typeof createAuthClient>>) {
  let gate = await guardApiRoute(supabase, "integration.manage");
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "integration.admin");
  }
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "configuration.manage");
  }
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "configuration.admin");
  }
  return gate;
}

/**
 * The per-user branch: a staff member connecting their OWN Google account.
 *
 * Deliberately does NOT call guardIntegrations. Connecting your own mailbox is
 * not an administrative act — requiring integration.manage would mean only
 * admins could use their own inbox, which is the opposite of the point.
 *
 * What IS still checked: that the signed state's user is the session's user, so
 * a state cannot be replayed into someone else's account.
 */
async function handleUserConnection(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  code: string,
  parsed: { organizationId: string; userId: string }
): Promise<NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return settingsRedirect({ error: "not_signed_in", connected: "0" });
  }
  if (user.id !== parsed.userId) {
    return settingsRedirect({ error: "state_user_mismatch", connected: "0" });
  }

  const tokens = await exchangeGoogleAuthorizationCode(code);
  if ("error" in tokens) {
    return settingsRedirect({ error: tokens.error, connected: "0" });
  }

  const { saveUserGoogleConnection } = await import(
    "@/lib/platform/integrations/connections/google-user"
  );

  const saved = await saveUserGoogleConnection({
    userId: user.id,
    organizationId: parsed.organizationId,
    googleEmail: user.email ?? null,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    grantedScopes: tokens.grantedScopes,
  });

  if (!saved.ok) {
    return settingsRedirect({ error: saved.error, connected: "0" });
  }

  await logSecurityEvent(supabase, {
    eventType: "sensitive_access",
    summary: "Personal Google account connected",
    actorUserId: user.id,
    userId: user.id,
    metadata: {
      organizationId: parsed.organizationId,
      provider: "google_user",
      connectionId: saved.id,
      grantedScopes: tokens.grantedScopes,
    },
  });

  return settingsRedirect({ connected: "1", scope: "personal" });
}

/**
 * GET /api/integrations/google/callback
 * Google OAuth return — verifies signed state, session, org membership, then persists.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return settingsRedirect({
      error: oauthError,
      connected: "0",
    });
  }

  if (!code || !state) {
    return settingsRedirect({ error: "missing_code", connected: "0" });
  }

  const parsed = parseGoogleOAuthState(state);
  if (!parsed) {
    return settingsRedirect({ error: "invalid_state", connected: "0" });
  }

  const supabase = await createAuthClient();

  // TWO FLOWS, ONE REDIRECT URI.
  //
  // `mode` travels in the SIGNED state, so it cannot be edited in transit — the
  // prefix in the state string is not covered by the HMAC, the payload is.
  // Reusing this route meant the per-user flow needed no new redirect URI
  // registered in Google Cloud, which on 7 September was worth a lot.
  //
  // The permission gate differs, and that difference is the point: connecting
  // the ORGANISATION's Google account is an integration-admin act. Connecting
  // YOUR OWN mailbox requires only that you are signed in as yourself.
  if (parsed.mode === "user") {
    return handleUserConnection(supabase, code, parsed);
  }

  const gate = await guardIntegrations(supabase);
  if (gate instanceof NextResponse) {
    return settingsRedirect({ error: "forbidden", connected: "0" });
  }

  if (gate.userId !== parsed.userId) {
    return settingsRedirect({ error: "state_user_mismatch", connected: "0" });
  }

  const orgScope = await requireOrganizationAccess(
    supabase,
    gate.userId,
    parsed.organizationId
  );
  if (orgScope !== true) {
    return settingsRedirect({ error: "forbidden_org", connected: "0" });
  }

  const tokens = await exchangeGoogleAuthorizationCode(code);
  if ("error" in tokens) {
    return settingsRedirect({ error: tokens.error, connected: "0" });
  }

  const saved = await upsertGoogleWorkspaceConnection(supabase, {
    organizationId: parsed.organizationId,
    userId: gate.userId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  });

  if (!saved.ok) {
    return settingsRedirect({ error: saved.error, connected: "0" });
  }

  await logSecurityEvent(supabase, {
    eventType: "sensitive_access",
    summary: "Google Workspace OAuth connection established",
    actorUserId: gate.userId,
    userId: gate.userId,
    metadata: {
      organizationId: parsed.organizationId,
      provider: "google_workspace",
      connectionId: saved.id,
    },
  });

  const { ensureSyncRegistry } = await import(
    "@/lib/platform/integrations/google-workspace/sync/registry-store"
  );
  await ensureSyncRegistry(supabase, saved.id, parsed.organizationId);

  return settingsRedirect({ connected: "1" });
}
