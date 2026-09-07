import { NextRequest, NextResponse } from "next/server";
import { canAccessConnectorOrganization } from "@/lib/connectors";
import {
  defaultPeriod,
  syncQuickBooksFinancials,
} from "@/lib/connectors/quickbooks/financials-sync";
import { getJagPlatformSession } from "@/lib/jag-platform/server-session";

export const maxDuration = 60;

/**
 * GET /api/jag-platform/connectors/quickbooks/sync-financials?org=<uuid>
 *        [&start=YYYY-MM-DD&end=YYYY-MM-DD]
 *
 * Reads each mapped company file's P&L and cash position and stores them.
 * Defaults to calendar year to date.
 *
 * NOT ON THE NIGHTLY RUNNER, deliberately. That run finishes at 55s of a 60s
 * ceiling; adding ten Intuit calls to it would push it back over. This gets its
 * own schedule once the figures are trusted -- and until then it is run by hand,
 * which is the right speed for numbers nobody has checked yet.
 */
export async function GET(request: NextRequest) {
  const session = await getJagPlatformSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const organizationId =
    request.nextUrl.searchParams.get("org") || session.organizationId;

  if (!organizationId || !canAccessConnectorOrganization(session, organizationId)) {
    return NextResponse.json(
      { ok: false, error: "Organization access denied." },
      { status: 403 }
    );
  }

  const fallback = defaultPeriod();
  const period = {
    start: request.nextUrl.searchParams.get("start") || fallback.start,
    end: request.nextUrl.searchParams.get("end") || fallback.end,
  };

  const results = await syncQuickBooksFinancials(organizationId, period);

  return NextResponse.json({
    ok: results.length > 0 && results.every((r) => r.ok),
    organizationId,
    period,
    synced: results.filter((r) => r.ok).length,
    of: results.length,
    results,
  });
}
