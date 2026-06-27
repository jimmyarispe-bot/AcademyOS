import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { logSecurityEvent } from "@/lib/platform/identity/security";
import { buildExecutiveBoardExport } from "@/lib/executive/reporting";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  let gate = await guardApiRoute(supabase, "executive.board_reports");
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "global.reporting");
    if (gate instanceof NextResponse) {
      gate = await guardApiRoute(supabase, "finance.export");
      if (gate instanceof NextResponse) return gate;
    }
  }

  const userId = (gate as { userId: string }).userId;

  const params = request.nextUrl.searchParams;
  const schoolId = params.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId required" }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const dateFrom = params.get("from") ?? `${year}-01-01`;
  const dateTo = params.get("to") ?? new Date().toISOString().split("T")[0];

  const csv = await buildExecutiveBoardExport(supabase, schoolId, dateFrom, dateTo);
  const filename = `executive-board-report-${dateTo}.csv`;

  await logSecurityEvent(supabase, {
    eventType: "export",
    actorUserId: userId,
    summary: "Executive board CSV export",
    metadata: { filename, schoolId, dateFrom, dateTo },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
