import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import {
  buildCsvExport,
  classProfitabilityToRows,
  teacherProfitabilityToRows,
  programProfitabilityToRows,
  studentEconomicsToRows,
  familyAnalyticsToRows,
} from "@/lib/financial-intelligence/reporting";
import {
  computeClassProfitability,
  computeTeacherProfitability,
  computeProgramProfitability,
  computeStudentEconomics,
} from "@/lib/financial-intelligence/profitability";
import { getFamilyAnalytics } from "@/lib/financial-intelligence/family-analytics";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  let gate = await guardApiRoute(supabase, "fi.view");
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "fi.executive");
    if (gate instanceof NextResponse) {
      gate = await guardApiRoute(supabase, "finance.view");
      if (gate instanceof NextResponse) return gate;
    }
  }

  const url = request.nextUrl;
  const type = url.searchParams.get("type") ?? "classes";
  const schoolId = url.searchParams.get("school_id") ?? undefined;

  if (!schoolId) {
    return NextResponse.json({ error: "school_id required" }, { status: 400 });
  }

  const date = new Date().toISOString().split("T")[0];

  if (type === "teachers") {
    const rows = teacherProfitabilityToRows(await computeTeacherProfitability(supabase, schoolId));
    const csv = buildCsvExport(rows, Object.keys(rows[0] ?? { employee_name: "" }));
    return csvResponse(csv, `fi-teachers-${date}.csv`);
  }

  if (type === "programs") {
    const rows = programProfitabilityToRows(await computeProgramProfitability(supabase, schoolId));
    const csv = buildCsvExport(rows, Object.keys(rows[0] ?? { program: "" }));
    return csvResponse(csv, `fi-programs-${date}.csv`);
  }

  if (type === "students") {
    const rows = studentEconomicsToRows(await computeStudentEconomics(supabase, schoolId, 200));
    const csv = buildCsvExport(rows, Object.keys(rows[0] ?? { student_name: "" }));
    return csvResponse(csv, `fi-students-${date}.csv`);
  }

  if (type === "families") {
    const rows = familyAnalyticsToRows(await getFamilyAnalytics(supabase, schoolId, 200));
    const csv = buildCsvExport(rows, Object.keys(rows[0] ?? { family_id: "" }));
    return csvResponse(csv, `fi-families-${date}.csv`);
  }

  const rows = classProfitabilityToRows(await computeClassProfitability(supabase, schoolId, "monthly"));
  const csv = buildCsvExport(rows, Object.keys(rows[0] ?? { section_code: "" }));
  return csvResponse(csv, `fi-classes-${date}.csv`);
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
