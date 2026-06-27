import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { getProjectSummaryReport, getTaskSummaryReport, buildCsvExport } from "@/lib/work/reports";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  let gate = await guardApiRoute(supabase, "work.reports");
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "work.view");
    if (gate instanceof NextResponse) return gate;
  }

  const url = request.nextUrl;
  const type = url.searchParams.get("type") ?? "projects";
  const schoolId = url.searchParams.get("school_id") ?? undefined;

  if (type === "tasks") {
    const rows = await getTaskSummaryReport(supabase, schoolId);
    const csv = buildCsvExport(rows as Record<string, unknown>[], [
      "school_id",
      "status",
      "priority",
      "task_count",
      "overdue_count",
      "total_estimated_hours",
      "total_actual_hours",
    ]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="work-tasks-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  const rows = await getProjectSummaryReport(supabase, schoolId);
  const csv = buildCsvExport(rows as Record<string, unknown>[], [
    "school_name",
    "department",
    "project_type",
    "status",
    "health_indicator",
    "project_count",
    "avg_completion_pct",
    "delayed_count",
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="work-projects-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
