import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import {
  buildFundingExportCsv,
  getStateFundingAwards,
} from "@/lib/admissions/state-funding";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { logSecurityEvent } from "@/lib/platform/identity/security";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  const gate = await guardApiRoute(supabase, "funding.export");
  if (gate instanceof NextResponse) return gate;

  const params = request.nextUrl.searchParams;
  const awards = await getStateFundingAwards({
    state: params.get("state") ?? undefined,
    programId: params.get("programId") ?? undefined,
    schoolId: params.get("schoolId") ?? undefined,
    awardYear: params.get("awardYear") ?? undefined,
    verificationStatus: params.get("verificationStatus") ?? undefined,
  });

  const csv = buildFundingExportCsv(awards);
  const filename = `state-funding-export-${new Date().toISOString().split("T")[0]}.csv`;

  await logSecurityEvent(supabase, {
    eventType: "export",
    actorUserId: gate.userId,
    summary: "State funding CSV export",
    metadata: { filename, rowCount: awards.length },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
