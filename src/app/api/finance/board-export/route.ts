import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { logSecurityEvent } from "@/lib/platform/identity/security";
import { buildFinanceBoardExport } from "@/lib/finance/export";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  const gate = await guardApiRoute(supabase, "finance.export");
  if (gate instanceof NextResponse) return gate;

  const params = request.nextUrl.searchParams;
  const schoolId = params.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId required" }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const dateFrom = params.get("from") ?? `${year}-01-01`;
  const dateTo = params.get("to") ?? new Date().toISOString().split("T")[0];

  const csv = await buildFinanceBoardExport(supabase, schoolId, dateFrom, dateTo);
  const filename = `finance-board-export-${dateTo}.csv`;

  await logSecurityEvent(supabase, {
    eventType: "export",
    actorUserId: gate.userId,
    summary: "Finance board CSV export",
    metadata: { filename, schoolId, dateFrom, dateTo },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
