import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getPrimaryOrganizationId } from "@/lib/configuration/context";
import { buildGoogleConnectAuthorizeUrl } from "@/lib/platform/integrations/connections";
import { resolvePublicAppOrigin } from "@/lib/platform/branding";

/**
 * GET /api/integrations/google/user/connect
 *
 * Starts the PER-USER Google OAuth round trip: a staff member connecting their
 * own account so JAG can show them their own mail and calendar.
 *
 * NO INTEGRATION-ADMIN GATE, on purpose. Connecting your own mailbox is not an
 * administrative act. Requiring integration.manage here would mean only admins
 * could use their own inbox, which defeats the feature. Being signed in is the
 * whole requirement.
 *
 * GET AND A REDIRECT, not POST-and-JSON. A person clicking "Connect Google"
 * should end up on Google's consent screen, and a link does that with no
 * client-side code. It also means this is testable by visiting the URL, before
 * any button exists — which is how it will first be exercised.
 *
 * NO DEMO FALLBACK. The org connect route has one, and on 7 September the
 * equivalent fallback in the QuickBooks connector meant a Connect button that
 * could only ever pretend: it reported success, wrote nothing durable, and hid
 * a real misconfiguration for months. If Google is not configured, say so.
 */
export async function GET() {
  const supabase = await createAuthClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const base = resolvePublicAppOrigin();
    return NextResponse.redirect(new URL("/login", base));
  }

  const organizationId = await getPrimaryOrganizationId(supabase);
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "No organization found for this account." },
      { status: 400 }
    );
  }

  const built = buildGoogleConnectAuthorizeUrl({
    organizationId,
    userId: user.id,
    mode: "user",
  });

  if ("error" in built) {
    return NextResponse.json({ ok: false, error: built.error }, { status: 400 });
  }

  return NextResponse.redirect(built.authorizeUrl);
}
