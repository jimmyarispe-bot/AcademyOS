import { NextResponse } from "next/server";
import { squareConfig } from "@/lib/connectors/square/config";
import { listSquareLocations } from "@/lib/connectors/square/client";
import { getJagPlatformSession } from "@/lib/jag-platform/server-session";

/**
 * GET /api/jag-platform/connectors/square/verify
 *
 * Proves the Square credentials work. Lists locations. Moves no money, stores
 * nothing, and cannot charge anything -- deliberately the first thing built,
 * because the alternative is discovering a credential problem with a family's
 * card in the middle of it.
 *
 * Returns the location ids so SQUARE_LOCATION_ID can be set from something
 * Square actually reported rather than copied from a dashboard by hand.
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
        environment: cfg.environment,
        missing: cfg.missing,
        error: result.error,
        needsSetup: result.needsSetup,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    environment: cfg.environment,
    // Loud, because sandbox looks exactly like production until a family's card
    // silently does nothing.
    warning:
      cfg.environment === "sandbox"
        ? "SANDBOX. No real money moves. Set SQUARE_ENVIRONMENT=production when ready."
        : undefined,
    missing: cfg.missing,
    locationIdConfigured: cfg.locationId || null,
    locations: result.locations,
  });
}
