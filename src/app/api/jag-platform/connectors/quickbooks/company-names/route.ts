import { NextRequest, NextResponse } from "next/server";
import { canAccessConnectorOrganization } from "@/lib/connectors";
import { refreshQuickBooksCompanyNames } from "@/lib/connectors/quickbooks/company-info";
import { getJagPlatformSession } from "@/lib/jag-platform/server-session";

/**
 * GET /api/jag-platform/connectors/quickbooks/company-names?org=<uuid>
 *
 * Asks Intuit for the real name of every connected company file and stores it,
 * replacing the `QuickBooks Company <realmId>` placeholder the callback writes.
 *
 * GET, so it can be run by visiting the URL. It changes only a display name --
 * nothing financial, nothing destructive -- and the alternative was blocking the
 * mapping of seven identical-looking books on building a screen first.
 *
 * Returns the before/after per book, including Intuit's LegalName, which is
 * often the one that says which entity you are actually looking at.
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

  const results = await refreshQuickBooksCompanyNames(organizationId);

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    organizationId,
    checked: results.length,
    named: results.filter((r) => r.ok).length,
    results,
  });
}
