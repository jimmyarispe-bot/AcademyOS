import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ClassProfitabilityRow } from "@/lib/financial-intelligence/types";
import { computeClassProfitability } from "@/lib/financial-intelligence/profitability";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/**
 * @param precomputedClasses class profitability the caller has ALREADY awaited.
 *   Pass it. Computing it is the single most expensive thing in the financial
 *   sync, and the nightly job used to run it three times per school with
 *   identical arguments -- here, and again inside generateFinancialAlerts, on
 *   top of the caller's own call. Omit it only when you have nothing to hand.
 */
export async function computeBreakEvenAnalysis(
  supabase: AuthClient,
  schoolId: string,
  precomputedClasses?: ClassProfitabilityRow[]
) {
  const classes =
    precomputedClasses ?? (await computeClassProfitability(supabase, schoolId, "monthly"));
  const today = new Date().toISOString().split("T")[0];

  const underperforming = classes.filter((c) => c.currentEnrollment < c.breakEvenEnrollment);
  const aboveTarget = classes.filter((c) => c.marginPct >= 15);

  // One insert for the whole set, not one round trip per class. With four
  // schools inside a 12-second budget, a per-row loop over every open section
  // was a meaningful part of why this job had never once finished.
  if (classes.length) {
    const { error } = await supabase.from("fi_break_even_snapshots").insert(
      classes.map((cls) => ({
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
      }))
    );
    if (error) {
      console.error("[computeBreakEvenAnalysis] snapshot insert failed", {
        schoolId,
        rows: classes.length,
        error: error.message,
      });
    }
  }

  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, max_capacity, instructional_minutes, courses(school_id)")
    .eq("status", "open");

  const schoolSections = (sections ?? []).filter((s) => {
    const c = Array.isArray(s.courses) ? s.courses[0] : s.courses;
    return (c as { school_id?: string })?.school_id === schoolId;
  });

  let totalCapacity = 0;
  let usedSeats = 0;
  const sectionIds = schoolSections.map((s) => s.id);
  const enrollmentCounts = new Map<string, number>();

  if (sectionIds.length) {
    const { data: enrollments } = await supabase
      .from("student_enrollments")
      .select("course_section_id")
      .in("course_section_id", sectionIds)
      .eq("enrollment_status", "enrolled");
    for (const e of enrollments ?? []) {
      if (!e.course_section_id) continue;
      enrollmentCounts.set(e.course_section_id, (enrollmentCounts.get(e.course_section_id) ?? 0) + 1);
    }
  }

  for (const s of schoolSections) {
    totalCapacity += s.max_capacity ?? 0;
    usedSeats += enrollmentCounts.get(s.id) ?? 0;
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
