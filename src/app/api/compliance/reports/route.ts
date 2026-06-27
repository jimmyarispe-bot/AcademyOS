import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { logSecurityEvent } from "@/lib/platform/identity/security";
import { buildComplianceSummaryReport, buildOverdueReport } from "@/lib/compliance/reports";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  let gate = await guardApiRoute(supabase, "compliance.reports");
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "compliance.view");
    if (gate instanceof NextResponse) return gate;
  }

  const userId = (gate as { userId: string }).userId;
  const params = request.nextUrl.searchParams;
  const schoolId = params.get("schoolId") || undefined;
  const type = params.get("type") ?? "summary";

  const csv = type === "overdue"
    ? await buildOverdueReport(supabase, schoolId)
    : await buildComplianceSummaryReport(supabase, schoolId);

  const filename = `compliance-${type}-${new Date().toISOString().split("T")[0]}.csv`;

  await logSecurityEvent(supabase, {
    eventType: "export",
    actorUserId: userId,
    summary: `Compliance ${type} report export`,
    metadata: { filename, schoolId, type },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
