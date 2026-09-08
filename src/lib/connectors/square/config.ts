/**
 * Square credentials, from the environment.
 *
 * ONE SQUARE ACCOUNT, SO A PERSONAL ACCESS TOKEN RATHER THAN OAUTH. The
 * existing OAuth scaffolding at
 * lib/platform/integrations/connectors/square/auth.ts is for connecting THIRD
 * PARTY merchants -- and its scope list is PAYMENTS_READ, ORDERS_READ and so on,
 * every one of them read-only. It could never have charged a card no matter how
 * it was wired.
 *
 * SQUARE_ENVIRONMENT FALLS BACK TO SANDBOX, deliberately and loudly. The
 * QuickBooks connector has the same shape and it is the single most dangerous
 * default in this codebase: miss the variable and everything connects, works,
 * and reports figures from a test account. For Square the failure is worse than
 * wrong numbers -- a card that appears charged and never was. So `configured`
 * is false unless the environment is stated explicitly.
 */

export type SquareEnvironmentName = "production" | "sandbox";

export interface SquareConfig {
  readonly accessToken: string;
  readonly applicationId: string;
  readonly locationId: string;
  readonly environment: SquareEnvironmentName;
  readonly apiBase: string;
  readonly configured: boolean;
  readonly missing: readonly string[];
}

export function squareConfig(): SquareConfig {
  const accessToken = (process.env.SQUARE_ACCESS_TOKEN ?? "").trim();
  const applicationId = (process.env.SQUARE_APPLICATION_ID ?? "").trim();
  const locationId = (process.env.SQUARE_LOCATION_ID ?? "").trim();
  const declared = (process.env.SQUARE_ENVIRONMENT ?? "").trim().toLowerCase();

  const environment: SquareEnvironmentName =
    declared === "production" ? "production" : "sandbox";

  const missing: string[] = [];
  if (!accessToken) missing.push("SQUARE_ACCESS_TOKEN");
  if (!applicationId) missing.push("SQUARE_APPLICATION_ID");
  // Not required to verify credentials -- /v2/locations is what discovers it --
  // but required before any payment can be taken.
  if (!locationId) missing.push("SQUARE_LOCATION_ID");
  if (declared !== "production" && declared !== "sandbox") {
    missing.push("SQUARE_ENVIRONMENT (must be exactly 'production' or 'sandbox')");
  }

  return {
    accessToken,
    applicationId,
    locationId,
    environment,
    apiBase:
      environment === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com",
    configured: missing.length === 0,
    missing,
  };
}

/** Square pins its API by date; changing this changes response shapes. */
export const SQUARE_API_VERSION = "2025-01-23";
