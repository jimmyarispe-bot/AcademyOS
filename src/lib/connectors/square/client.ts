/**
 * Square API client — the real one.
 *
 * Replaces nothing yet. `InMemorySquarePort` in lib/platform/finance/payments
 * returns `{ id: "sq-<timestamp>", status: "completed" }` without contacting
 * Square, ignores the amount, and is the default port. It has no callers, so it
 * has never falsely settled an invoice -- but it is what "Square" has meant in
 * this codebase until now.
 *
 * MONEY IS IN INTEGER CENTS. Square's API takes amounts as integer minor units,
 * and float dollars are how rounding errors become real money. Nothing in this
 * file accepts a float amount.
 */

import { SQUARE_API_VERSION, squareConfig } from "@/lib/connectors/square/config";

export type SquareLocation = {
  id: string;
  name: string;
  status: string;
  currency: string | null;
  country: string | null;
};

type SquareError = { category?: string; code?: string; detail?: string };

function describe(errors: SquareError[] | undefined, status: number): string {
  if (!errors?.length) return `Square returned HTTP ${status}.`;
  // Square's own wording is more useful than anything invented here.
  return errors
    .map((e) => [e.code, e.detail].filter(Boolean).join(": "))
    .join("; ")
    .slice(0, 400);
}

async function squareGet<T>(
  path: string
): Promise<{ ok: true; data: T } | { ok: false; error: string; needsSetup: boolean }> {
  const cfg = squareConfig();
  if (!cfg.accessToken) {
    return {
      ok: false,
      error: "SQUARE_ACCESS_TOKEN is not set on this deployment.",
      needsSetup: true,
    };
  }

  let response: Response;
  try {
    response = await fetch(`${cfg.apiBase}${path}`, {
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "Square-Version": SQUARE_API_VERSION,
        Accept: "application/json",
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Square request failed",
      needsSetup: false,
    };
  }

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: `Square returned a non-JSON response (HTTP ${response.status}).`,
      needsSetup: false,
    };
  }

  if (!response.ok) {
    const errors = (json as { errors?: SquareError[] }).errors;
    // A 401 here means the TOKEN is wrong -- not expired, not a scope problem.
    // Saying so beats "unauthorized", which sent an afternoon chasing the wrong
    // thing on the QuickBooks connector today.
    const prefix =
      response.status === 401
        ? "Square rejected the access token (check SQUARE_ACCESS_TOKEN and that " +
          "SQUARE_ENVIRONMENT matches the token's environment): "
        : "";
    return {
      ok: false,
      error: prefix + describe(errors, response.status),
      needsSetup: response.status === 401,
    };
  }

  return { ok: true, data: json as T };
}

/**
 * List the account's locations.
 *
 * The cheapest possible proof that the credentials work, and it moves no money.
 * It also returns the location id every payment must carry, which is why this
 * runs before anything else is built on top.
 */
export async function listSquareLocations(): Promise<
  | { ok: true; locations: SquareLocation[] }
  | { ok: false; error: string; needsSetup: boolean }
> {
  const result = await squareGet<{
    locations?: {
      id: string;
      name?: string;
      status?: string;
      currency?: string;
      country?: string;
    }[];
  }>("/v2/locations");

  if (!result.ok) return result;

  return {
    ok: true,
    locations: (result.data.locations ?? []).map((l) => ({
      id: l.id,
      name: l.name ?? "(unnamed)",
      status: l.status ?? "UNKNOWN",
      currency: l.currency ?? null,
      country: l.country ?? null,
    })),
  };
}
