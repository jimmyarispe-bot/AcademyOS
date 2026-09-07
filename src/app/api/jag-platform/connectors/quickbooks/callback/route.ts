import { NextResponse } from "next/server";
import {
  canAccessConnectorOrganization,
  exchangeQuickBooksAuthorizationCode,
  parseQuickBooksOAuthState,
  saveQuickBooksTokens,
} from "@/lib/connectors";
import { saveQuickBooksConnection } from "@/lib/connectors/quickbooks/persistence";
import { getJagPlatformSession } from "@/lib/jag-platform/server-session";
import { resolvePublicAppOrigin } from "@/lib/platform/branding";

function redirectToConnectors(query: Record<string, string>): NextResponse {
  const base = resolvePublicAppOrigin();
  const url = new URL("/jag/connectors", base);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

/**
 * GET — Intuit OAuth callback.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return redirectToConnectors({ qbo: "error", reason: oauthError });
  }
  if (!code || !state || !realmId) {
    return redirectToConnectors({ qbo: "error", reason: "missing_params" });
  }

  const parsed = parseQuickBooksOAuthState(state);
  if (!parsed) {
    return redirectToConnectors({ qbo: "error", reason: "invalid_state" });
  }

  const session = await getJagPlatformSession();
  if (!session) {
    return redirectToConnectors({ qbo: "error", reason: "unauthorized" });
  }
  if (session.userId !== parsed.userId) {
    return redirectToConnectors({ qbo: "error", reason: "state_user_mismatch" });
  }
  if (!canAccessConnectorOrganization(session, parsed.organizationId)) {
    return redirectToConnectors({ qbo: "error", reason: "forbidden_org" });
  }

  const tokens = await exchangeQuickBooksAuthorizationCode({
    code,
    realmId,
  });
  if (!tokens.ok) {
    // SAY WHAT INTUIT SAID.
    //
    // exchangeTokenRequest already captures Intuit's own explanation --
    // `json.error_description || json.error` -- into a typed error with a code
    // and a message. This branch then threw all of it away and redirected with
    // the bare word "token_exchange", which names the step that failed and
    // nothing about why.
    //
    // The difference matters: "invalid_client" means the secret is wrong,
    // "invalid_grant" means the code was already used or expired, and
    // "redirect_uri mismatch" means the URI on the token call does not match
    // the one on the authorize call. Three different fixes, one indistinguishable
    // error message.
    const detail = tokens.error || "unknown";
    console.error("[qbo callback] token exchange failed", { realmId, detail });
    return redirectToConnectors({
      qbo: "error",
      reason: "token_exchange",
      detail: detail.slice(0, 300),
    });
  }

  // DURABLE FIRST, AND ITS FAILURE IS FATAL TO THE REDIRECT.
  //
  // Until now this route called only saveQuickBooksTokens, which writes to
  // `globalThis.__jagConnectorStore` -- in memory, per lambda instance, gone on
  // the next cold start. On 7 September all five books authorised through
  // Intuit successfully and fi_quickbooks_connections held zero rows. The
  // connect flow said "connected" and stored nothing that outlived the request.
  //
  // So the database write happens first and a failure surfaces as an error
  // instead of a green banner. Reporting success for a connection that was not
  // persisted is the exact fault this route already had twice today.
  const saved = await saveQuickBooksConnection({
    organizationId: parsed.organizationId,
    userId: session.userId,
    tokens: tokens.tokens,
  });

  if (!saved.ok) {
    console.error("[qbo callback] persist failed", {
      realmId,
      error: saved.error,
    });
    return redirectToConnectors({
      qbo: "error",
      reason: "not_saved",
      detail: saved.error.slice(0, 300),
    });
  }

  // The in-memory store still backs the existing connectors dashboard reads
  // within this instance. It is a cache now, not the record.
  saveQuickBooksTokens({
    organizationId: parsed.organizationId,
    tokens: tokens.tokens,
  });

  return redirectToConnectors({
    org: parsed.organizationId,
    qbo: "connected",
    // A new book arrives unmapped -- Intuit's company picker chose the realm,
    // not JAG. The connectors page can prompt for the mapping instead of the
    // person discovering later that GA's figures sat under FL.
    ...(saved.created ? { mapping: "needed" } : {}),
  });
}
