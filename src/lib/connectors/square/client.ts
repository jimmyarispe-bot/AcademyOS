/**
 * Square API client — the real one.
 *
 * Replaces nothing yet. `InMemorySquarePort` in lib/platform/finance/payments
 * returns `{ id: "sq-<timestamp>", status: "completed" }` without contacting
 * Square, ignores the amount, and is the default port. It has no callers, so it
 * has never falsely settled an invoice.
 *
 * MONEY IS IN INTEGER CENTS. Square takes minor units, and float dollars are
 * how rounding errors become real money.
 */

import {
  SQUARE_API_VERSION,
  SQUARE_HOSTS,
  squareConfig,
  type SquareEnvironmentName,
} from "@/lib/connectors/square/config";

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
  return errors
    .map((e) => [e.code, e.detail].filter(Boolean).join(": "))
    .join("; ")
    .slice(0, 400);
}

type Attempt =
  | { ok: true; environment: SquareEnvironmentName; data: unknown }
  | { ok: false; environment: SquareEnvironmentName; status: number; error: string };

async function callOnce(
  environment: SquareEnvironmentName,
  path: string,
  accessToken: string
): Promise<Attempt> {
  try {
    const response = await fetch(`${SQUARE_HOSTS[environment]}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_API_VERSION,
        Accept: "application/json",
      },
    });
    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        environment,
        status: response.status,
        error: `Non-JSON response (HTTP ${response.status}).`,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        environment,
        status: response.status,
        error: describe((json as { errors?: SquareError[] }).errors, response.status),
      };
    }
    return { ok: true, environment, data: json };
  } catch (err) {
    return {
      ok: false,
      environment,
      status: 0,
      error: err instanceof Error ? err.message : "Square request failed",
    };
  }
}

/**
 * Call Square, discovering the environment when it is not pinned.
 *
 * A token belongs to exactly one environment and Square will say so. Trying
 * production and falling back to sandbox costs one extra request, once, and
 * removes an entire category of misconfiguration -- one that cost an evening
 * because a variable that was demonstrably set kept arriving empty.
 */
async function squareGet(
  path: string
): Promise<
  | { ok: true; environment: SquareEnvironmentName; data: unknown }
  | { ok: false; error: string; tried: SquareEnvironmentName[] }
> {
  const cfg = squareConfig();
  if (!cfg.accessToken) {
    return {
      ok: false,
      error: "SQUARE_ACCESS_TOKEN is not set on this deployment.",
      tried: [],
    };
  }

  const order: SquareEnvironmentName[] = cfg.pinnedEnvironment
    ? [cfg.pinnedEnvironment]
    : ["production", "sandbox"];

  const failures: string[] = [];
  for (const environment of order) {
    const attempt = await callOnce(environment, path, cfg.accessToken);
    if (attempt.ok) return { ok: true, environment, data: attempt.data };
    failures.push(`${environment}: ${attempt.error}`);
    // Only a 401 means "wrong environment for this token". Anything else is a
    // real failure and trying the other host would just obscure it.
    if (attempt.status !== 401) break;
  }

  return {
    ok: false,
    error: failures.join(" | "),
    tried: order,
  };
}

export async function listSquareLocations(): Promise<
  | { ok: true; environment: SquareEnvironmentName; locations: SquareLocation[] }
  | { ok: false; error: string; tried: SquareEnvironmentName[] }
> {
  const result = await squareGet("/v2/locations");
  if (!result.ok) return result;

  const data = result.data as {
    locations?: {
      id: string;
      name?: string;
      status?: string;
      currency?: string;
      country?: string;
    }[];
  };

  return {
    ok: true,
    environment: result.environment,
    locations: (data.locations ?? []).map((l) => ({
      id: l.id,
      name: l.name ?? "(unnamed)",
      status: l.status ?? "UNKNOWN",
      currency: l.currency ?? null,
      country: l.country ?? null,
    })),
  };
}
