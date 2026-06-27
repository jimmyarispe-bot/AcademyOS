import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { logSecurityEvent } from "@/lib/platform/identity/security";
import {
  buildSsissFundingExportCsv,
  getSsissFundingExportData,
} from "@/lib/ssis/funding";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  const gate = await guardApiRoute(supabase, "funding.export");
  if (gate instanceof NextResponse) return gate;

  const params = request.nextUrl.searchParams;
  const { records, studentMap } = await getSsissFundingExportData(supabase, {
    schoolId: params.get("schoolId") ?? undefined,
    stateCode: params.get("state") ?? undefined,
    program: params.get("program") ?? undefined,
    category: params.get("category") ?? undefined,
  });

  const csv = buildSsissFundingExportCsv(records as Record<string, unknown>[], studentMap);
  const filename = `ssis-funding-export-${new Date().toISOString().split("T")[0]}.csv`;

  await logSecurityEvent(supabase, {
    eventType: "export",
    actorUserId: gate.userId,
    summary: "SSIS student funding CSV export",
    metadata: { filename, rowCount: records.length },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
