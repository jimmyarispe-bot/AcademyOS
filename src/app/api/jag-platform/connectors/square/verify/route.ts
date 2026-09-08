import { NextResponse } from "next/server";
import { squareConfig } from "@/lib/connectors/square/config";
import { listSquareLocations } from "@/lib/connectors/square/client";
import { getJagPlatformSession } from "@/lib/jag-platform/server-session";

/**
 * GET /api/jag-platform/connectors/square/verify
 *
 * Proves the Square credentials work and reports which environment the token
 * belongs to. Lists locations. Moves no money and cannot charge anything.
 *
 * Requires only SQUARE_ACCESS_TOKEN. The environment is discovered rather than
 * declared, and the location id is what this route TELLS you -- asking for it
 * up front was asking for an answer that only this call can give.
 */
export async function GET() {
  const session = await getJagPlatformSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const cfg = squareConfig();
  const result = await listSquareLocations();

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        triedEnvironments: result.tried,
        hint:
          result.tried.length > 1
            ? "The token was rejected by both Square hosts, so it is not a valid access token for either environment. Replace SQUARE_ACCESS_TOKEN."
            : "SQUARE_ENVIRONMENT is pinned; unset it to let the token find its own environment.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    environment: result.environment,
    environmentSource: cfg.pinnedEnvironment ? "pinned by SQUARE_ENVIRONMENT" : "discovered",
    warning:
      result.environment === "sandbox"
        ? "SANDBOX TOKEN. No real money can move with this token."
        : undefined,
    applicationIdSet: Boolean(cfg.applicationId),
    locationIdConfigured: cfg.locationId || null,
    setThisAsSquareLocationId: cfg.locationId ? null : result.locations[0]?.id ?? null,
    locations: result.locations,
  });
}
