import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { buildComplianceIcsFeed, obligationsToIcs } from "@/lib/compliance/calendar";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  const gate = await guardApiRoute(supabase, "compliance.view");
  if (gate instanceof NextResponse) return gate;

  const schoolId = request.nextUrl.searchParams.get("schoolId") || undefined;
  const obligations = await buildComplianceIcsFeed(supabase, schoolId);
  const ics = obligationsToIcs(obligations);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="academyos-compliance.ics"',
    },
  });
}
