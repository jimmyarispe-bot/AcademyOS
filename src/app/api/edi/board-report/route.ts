import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { buildBoardReportCsv } from "@/lib/edi/reporting";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  let gate = await guardApiRoute(supabase, "edi.board");
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "executive.board_reports");
    if (gate instanceof NextResponse) return gate;
  }

  const schoolId = request.nextUrl.searchParams.get("school_id");
  if (!schoolId) {
    return NextResponse.json({ error: "school_id required" }, { status: 400 });
  }

  const csv = await buildBoardReportCsv(supabase, schoolId);
  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="edi-board-report-${date}.csv"`,
    },
  });
}
