import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { EducationalRoiRow } from "@/lib/edi/types";
import { computeClassProfitability, computeProgramProfitability, computeTeacherProfitability } from "@/lib/financial-intelligence/profitability";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/** Educational ROI — weighted composite score with documented methodology */
export async function computeEducationalRoi(
  supabase: AuthClient,
  schoolId: string
): Promise<EducationalRoiRow[]> {
  const [classes, programs, teachers] = await Promise.all([
    computeClassProfitability(supabase, schoolId, "quarterly"),
    computeProgramProfitability(supabase, schoolId),
    computeTeacherProfitability(supabase, schoolId),
  ]);

  const rows: EducationalRoiRow[] = [];

  for (const cls of classes) {
    const financialRoi = cls.revenue ? (cls.netMargin / cls.revenue) * 100 : 0;
    const overall = financialRoi * 0.4 + cls.marginPct * 0.3 + (cls.currentEnrollment / Math.max(cls.breakEvenEnrollment, 1)) * 10;
    rows.push(await persistRoi(supabase, schoolId, {
      entityType: "class",
      entityId: cls.courseSectionId,
      entityKey: cls.sectionCode,
      financialRoi,
      studentGrowth: cls.currentEnrollment,
      goalAchievement: cls.marginPct,
      retention: cls.currentEnrollment,
      overallEducationalRoi: overall,
      methodology: { weights: { financial: 0.4, margin: 0.3, enrollment: 0.3 }, source: "FI class profitability" },
    }));
  }

  for (const prog of programs) {
    const marginPct = prog.revenue ? (prog.netMargin / prog.revenue) * 100 : 0;
    rows.push(await persistRoi(supabase, schoolId, {
      entityType: "program",
      entityKey: prog.program,
      financialRoi: marginPct,
      overallEducationalRoi: marginPct * 0.6 + prog.ebitdaContribution * 0.001,
      methodology: { weights: { margin: 0.6, ebitda: 0.4 }, source: "FI program profitability" },
    }));
  }

  for (const t of teachers) {
    const marginPct = t.revenueGenerated ? (t.netMargin / t.revenueGenerated) * 100 : 0;
    rows.push(await persistRoi(supabase, schoolId, {
      entityType: "teacher",
      entityId: t.employeeId,
      entityKey: t.employeeName,
      financialRoi: marginPct,
      studentGrowth: t.studentsServed,
      retention: t.studentsServed,
      overallEducationalRoi: marginPct * 0.5 + (t.revenuePerHour / Math.max(t.costPerHour, 1)) * 10,
      methodology: { weights: { margin: 0.5, revenue_per_hour: 0.5 }, source: "FI teacher profitability" },
    }));
  }

  return rows.sort((a, b) => b.overallEducationalRoi - a.overallEducationalRoi);
}

async function persistRoi(
  supabase: AuthClient,
  schoolId: string,
  row: EducationalRoiRow & { methodology: Record<string, unknown> }
): Promise<EducationalRoiRow> {
  await supabase.from("edi_educational_roi").upsert(
    {
      school_id: schoolId,
      entity_type: row.entityType,
      entity_id: row.entityId ?? null,
      entity_key: row.entityKey ?? null,
      financial_roi: row.financialRoi,
      student_growth: row.studentGrowth ?? null,
      attendance_improvement: row.attendanceImprovement ?? null,
      behavior_improvement: row.behaviorImprovement ?? null,
      goal_achievement: row.goalAchievement ?? null,
      parent_engagement: row.parentEngagement ?? null,
      retention: row.retention ?? null,
      overall_educational_roi: row.overallEducationalRoi,
      methodology: row.methodology,
    },
    { onConflict: "school_id,entity_type,entity_id,entity_key" }
  );
  return row;
}
