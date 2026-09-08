/**
 * Square credentials.
 *
 * SQUARE_ENVIRONMENT IS OPTIONAL, AND THAT IS THE WHOLE POINT.
 *
 * It was required, and it cost an hour on the evening of 7 September. The
 * variable was set in Vercel, scoped correctly, redeployed repeatedly, and the
 * runtime kept reporting it absent -- while SQUARE_ACCESS_TOKEN and
 * SQUARE_APPLICATION_ID, sitting beside it, arrived fine. Six rounds of
 * checking scopes and rebuilding never found out why.
 *
 * The lesson is not about Vercel. A token already knows which environment it
 * belongs to: production tokens work against connect.squareup.com and fail
 * against the sandbox host, and vice versa. Making a human retype that fact
 * into a form -- correctly, in a field they cannot read back once saved -- adds
 * a way to be wrong and no information. So the client asks Square instead.
 *
 * Set SQUARE_ENVIRONMENT to pin it. Leave it unset and the environment is
 * discovered and reported back.
 */

export type SquareEnvironmentName = "production" | "sandbox";

export const SQUARE_HOSTS: Record<SquareEnvironmentName, string> = {
  production: "https://connect.squareup.com",
  sandbox: "https://connect.squareupsandbox.com",
};

export interface SquareConfig {
  readonly accessToken: string;
  readonly applicationId: string;
  readonly locationId: string;
  /** Null when unpinned -- the client discovers it. */
  readonly pinnedEnvironment: SquareEnvironmentName | null;
  readonly configured: boolean;
  readonly missing: readonly string[];
}

export function squareConfig(): SquareConfig {
  const accessToken = (process.env.SQUARE_ACCESS_TOKEN ?? "").trim();
  const applicationId = (process.env.SQUARE_APPLICATION_ID ?? "").trim();
  const locationId = (process.env.SQUARE_LOCATION_ID ?? "").trim();
  const declared = (process.env.SQUARE_ENVIRONMENT ?? "").trim().toLowerCase();

  const pinnedEnvironment: SquareEnvironmentName | null =
    declared === "production" ? "production" : declared === "sandbox" ? "sandbox" : null;

  // ONLY THE TOKEN IS REQUIRED TO VERIFY. The application id is needed by the
  // card-capture page, and the location id by a payment -- neither blocks
  // finding out whether the credentials work, and treating them as blockers
  // turned a five-minute check into an evening.
  const missing: string[] = [];
  if (!accessToken) missing.push("SQUARE_ACCESS_TOKEN");

  return {
    accessToken,
    applicationId,
    locationId,
    pinnedEnvironment,
    configured: missing.length === 0,
    missing,
  };
}

export const SQUARE_API_VERSION = "2025-01-23";
