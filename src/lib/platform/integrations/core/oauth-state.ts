/**
 * HMAC-signed OAuth state — binds org + user and prevents CSRF / cross-org binding.
 *
 * Format: `<prefix>.<base64url(payload)>.<base64url(hmac)>`
 */

import { createHmac, timingSafeEqual } from "crypto";

export type OAuthStateClaims = {
  organizationId: string;
  userId: string;
  /**
   * Which kind of connection this round trip is for.
   *
   * "org"  — the single organisation-wide grant in integration_connections.
   *          Directory reads, the Classroom catalogue. Requires an integration
   *          admin permission.
   * "user" — one staff member's own account, in user_google_connections. Their
   *          mail, their calendar. Requires only that they are signed in.
   *
   * IT IS SIGNED, deliberately. The prefix in the state string is NOT covered
   * by the HMAC — only the payload is — so distinguishing the two flows by
   * prefix alone would let the mode be edited in transit. Carrying it as a
   * claim means it cannot be.
   *
   * Absent means "org", so states issued before this existed still parse.
   */
  mode?: "org" | "user";
  /** Expiry unix ms */
  exp: number;
  /** One-time nonce */
  n: string;
};

const DEFAULT_TTL_MS = 15 * 60 * 1000;

function stateSecret(): string {
  const secret =
    process.env.OAUTH_STATE_SECRET ||
    process.env.VAULT_ENCRYPTION_KEY ||
    process.env.CRON_SECRET;
  if (!secret) {
    throw new Error(
      "OAuth state signing requires OAUTH_STATE_SECRET, VAULT_ENCRYPTION_KEY, or CRON_SECRET"
    );
  }
  return secret;
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", stateSecret()).update(payloadB64).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function createSignedOAuthState(
  prefix: string,
  input: { organizationId: string; userId: string; mode?: "org" | "user" },
  ttlMs = DEFAULT_TTL_MS
): string {
  const claims: OAuthStateClaims = {
    organizationId: input.organizationId,
    userId: input.userId,
    ...(input.mode ? { mode: input.mode } : {}),
    exp: Date.now() + ttlMs,
    n: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
  };
  const payloadB64 = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const sig = signPayload(payloadB64);
  return `${prefix}.${payloadB64}.${sig}`;
}

export function parseSignedOAuthState(
  prefix: string,
  state: string
): OAuthStateClaims | null {
  try {
    const parts = state.split(".");
    if (parts.length !== 3) return null;
    const [gotPrefix, payloadB64, sig] = parts;
    if (gotPrefix !== prefix || !payloadB64 || !sig) return null;
    if (!safeEqual(signPayload(payloadB64), sig)) return null;

    const claims = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as Partial<OAuthStateClaims>;

    if (
      typeof claims.organizationId !== "string" ||
      typeof claims.userId !== "string" ||
      typeof claims.exp !== "number" ||
      typeof claims.n !== "string"
    ) {
      return null;
    }
    if (Date.now() > claims.exp) return null;

    return {
      organizationId: claims.organizationId,
      userId: claims.userId,
      // Carried through deliberately. This function rebuilds the object field
      // by field rather than spreading the parsed claims, so anything not named
      // here is silently dropped -- which is exactly what happened to `mode`
      // the first time: signed correctly, verified correctly, and discarded on
      // the way out. Only "user" is honoured; anything else means org.
      ...(claims.mode === "user" ? { mode: "user" as const } : {}),
      exp: claims.exp,
      n: claims.n,
    };
  } catch {
    return null;
  }
}
