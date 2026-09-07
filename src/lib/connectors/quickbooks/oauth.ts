/**
 * QuickBooks Online OAuth 2.0 — connect / exchange / refresh.
 * Secrets are never logged.
 */

import {
  createSignedOAuthState,
  parseSignedOAuthState,
} from "@/lib/platform/integrations/core/oauth-state";
import {
  quickbooksAuthorizeUrl,
  quickbooksClientConfig,
} from "@/lib/connectors/quickbooks/config";
import { classifyQboHttpError, qboError } from "@/lib/connectors/quickbooks/errors";
import type { QboTokenBundle } from "@/lib/connectors/quickbooks/types";

const STATE_PREFIX = "qbo";

export function createQuickBooksOAuthState(input: {
  organizationId: string;
  userId: string;
}): string {
  return createSignedOAuthState(STATE_PREFIX, input);
}

export function parseQuickBooksOAuthState(state: string) {
  return parseSignedOAuthState(STATE_PREFIX, state);
}

export function buildQuickBooksAuthorizeUrl(input: {
  organizationId: string;
  userId: string;
}): { authorizeUrl: string } | { error: string } {
  const cfg = quickbooksClientConfig();
  if (!cfg.configured) {
    return {
      error:
        "QuickBooks OAuth is not configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET, or use demo connect.",
    };
  }
  const state = createQuickBooksOAuthState(input);
  return {
    authorizeUrl: quickbooksAuthorizeUrl({
      state,
      clientId: cfg.clientId,
      redirectUri: cfg.redirectUri,
    }),
  };
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  x_refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
};

async function exchangeTokenRequest(
  body: URLSearchParams
): Promise<
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
      refreshTokenExpiresAt?: string;
    }
  | { ok: false; error: ReturnType<typeof qboError> }
> {
  const cfg = quickbooksClientConfig();
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString(
    "base64"
  );
  let response: Response;
  try {
    response = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      }
    );
  } catch (err) {
    return {
      ok: false,
      error: qboError(
        "network_failure",
        err instanceof Error ? err.message : "Token request failed.",
        true
      ),
    };
  }

  const text = await response.text();
  let json: TokenResponse = {};
  try {
    json = JSON.parse(text) as TokenResponse;
  } catch {
    return {
      ok: false,
      error: classifyQboHttpError(response.status, text),
    };
  }

  if (!response.ok || !json.access_token || !json.refresh_token) {
    if (json.error === "invalid_grant") {
      return {
        ok: false,
        error: qboError(
          "revoked_authorization",
          "QuickBooks refresh/authorization grant is invalid.",
          false
        ),
      };
    }
    return {
      ok: false,
      error: classifyQboHttpError(
        response.status,
        json.error_description || json.error || text
      ),
    };
  }

  const expiresIn = Number(json.expires_in ?? 3600);
  const refreshExpiresIn = Number(json.x_refresh_token_expires_in ?? 0);
  return {
    ok: true,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    // Parsed into TokenResponse since the beginning and never read. Storing it
    // is what lets a check say "this book stops working on the 14th" instead of
    // discovering it as an empty report.
    refreshTokenExpiresAt:
      refreshExpiresIn > 0
        ? new Date(Date.now() + refreshExpiresIn * 1000).toISOString()
        : undefined,
  };
}

export async function exchangeQuickBooksAuthorizationCode(input: {
  code: string;
  realmId: string;
  companyName?: string;
}): Promise<{ ok: true; tokens: QboTokenBundle } | { ok: false; error: string }> {
  const cfg = quickbooksClientConfig();
  const result = await exchangeTokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: cfg.redirectUri,
    })
  );
  if (!result.ok) {
    return { ok: false, error: result.error.message };
  }
  return {
    ok: true,
    tokens: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt,
      realmId: input.realmId,
      companyName: input.companyName ?? `QuickBooks Company ${input.realmId}`,
      environment: cfg.environment,
      demo: false,
    },
  };
}

export async function refreshQuickBooksTokens(
  refreshToken: string
): Promise<{ ok: true; tokens: Pick<QboTokenBundle, "accessToken" | "refreshToken" | "expiresAt"> } | { ok: false; error: ReturnType<typeof qboError> }> {
  const result = await exchangeTokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return {
    ok: true,
    tokens: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    },
  };
}

/** Demo tokens for local/dev when Intuit credentials are absent. */
export function createDemoQuickBooksTokens(input?: {
  companyName?: string;
  realmId?: string;
}): QboTokenBundle {
  const cfg = quickbooksClientConfig();
  return {
    accessToken: `demo-access-${Date.now()}`,
    refreshToken: `demo-refresh-${Date.now()}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    realmId: input?.realmId ?? "demo-realm-001",
    companyName: input?.companyName ?? "JAG Demo Academy Books",
    environment: cfg.environment,
    demo: true,
  };
}

export function isTokenExpired(expiresAt: string, skewMs = 60_000): boolean {
  return Date.parse(expiresAt) <= Date.now() + skewMs;
}
