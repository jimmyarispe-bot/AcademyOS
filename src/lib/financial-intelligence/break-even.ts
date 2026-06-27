import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ClassProfitabilityRow } from "@/lib/financial-intelligence/types";
import { computeClassProfitability } from "@/lib/financial-intelligence/profitability";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function computeBreakEvenAnalysis(supabase: AuthClient, schoolId: string) {
  const classes = await computeClassProfitability(supabase, schoolId, "monthly");
  const today = new Date().toISOString().split("T")[0];

  const underperforming = classes.filter((c) => c.currentEnrollment < c.breakEvenEnrollment);
  const aboveTarget = classes.filter((c) => c.marginPct >= 15);

  for (const cls of classes) {
    await supabase.from("fi_break_even_snapshots").insert({
      school_id: schoolId,
      entity_type: "class",
      entity_id: cls.courseSectionId,
      entity_key: cls.sectionCode,
      minimum_students: cls.breakEvenEnrollment,
      optimal_students: Math.min(cls.currentEnrollment + cls.availableSeats, cls.breakEvenEnrollment * 1.5),
      max_profitability_students: cls.currentEnrollment + cls.availableSeats,
      current_enrollment: cls.currentEnrollment,
      available_seats: cls.availableSeats,
      is_underperforming: cls.currentEnrollment < cls.breakEvenEnrollment,
      is_overstaffed: cls.profitPerHour < 0 && cls.currentEnrollment > 0,
      snapshot_date: today,
      metrics: { margin_pct: cls.marginPct, net_margin: cls.netMargin },
    });
  }

  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, max_capacity, instructional_minutes, courses(school_id)")
    .eq("status", "open");

  let totalCapacity = 0;
  let usedSeats = 0;
  for (const s of sections ?? []) {
    const c = Array.isArray(s.courses) ? s.courses[0] : s.courses;
    if ((c as { school_id?: string })?.school_id !== schoolId) continue;
    totalCapacity += s.max_capacity ?? 0;
    const { count } = await supabase
      .from("student_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("course_section_id", s.id)
      .eq("enrollment_status", "enrolled");
    usedSeats += count ?? 0;
  }

  return {
    underperformingClasses: underperforming,
    aboveTargetClasses: aboveTarget,
    unusedScheduleCapacity: Math.max(totalCapacity - usedSeats, 0),
    totalCapacity,
    usedSeats,
  };
}

export function summarizeBreakEven(classes: ClassProfitabilityRow[]) {
  return {
    belowBreakEven: classes.filter((c) => c.currentEnrollment < c.breakEvenEnrollment).length,
    aboveTargetMargin: classes.filter((c) => c.marginPct >= 15).length,
    averageMargin: classes.length
      ? classes.reduce((s, c) => s + c.marginPct, 0) / classes.length
      : 0,
  };
}
