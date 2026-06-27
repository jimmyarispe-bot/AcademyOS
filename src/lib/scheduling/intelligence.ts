import type { createAuthClient } from "@/lib/supabase/server-auth";
import { detectSchedulingConflicts, syncConflictsToMissionControl } from "@/lib/scheduling/conflicts";
import { getStaffWorkload } from "@/lib/scheduling/queries";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface SchedulingRecommendation {
  priority: "high" | "medium" | "low";
  category: string;
  title: string;
  detail: string;
  action?: string;
}

export async function generateSchedulingRecommendations(
  supabase: AuthClient,
  schoolId: string
): Promise<SchedulingRecommendation[]> {
  const recommendations: SchedulingRecommendation[] = [];

  const { data: existingConflicts } = await supabase
    .from("schedule_conflicts")
    .select("conflict_type, severity, title, description, recommendation")
    .eq("school_id", schoolId)
    .eq("is_resolved", false)
    .order("detected_at", { ascending: false })
    .limit(20);

  for (const c of existingConflicts ?? []) {
    recommendations.push({
      priority: c.severity === "critical" ? "high" : "medium",
      category: c.conflict_type,
      title: c.title,
      detail: c.description ?? "",
      action: c.recommendation ?? undefined,
    });
  }

  const workload = await getStaffWorkload(schoolId);
  for (const w of workload.filter((x) => x.overloaded)) {
    recommendations.push({
      priority: "high",
      category: "workload",
      title: `${w.name} is overloaded`,
      detail: `${w.weeklyHours} hours scheduled this week (${w.sessionCount} sessions)`,
      action: "Redistribute sessions or add co-teachers",
    });
  }

  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, section_code, max_capacity, status, courses(school_id)")
    .eq("status", "open");

  for (const section of sections ?? []) {
    const course = Array.isArray(section.courses) ? section.courses[0] : section.courses;
    if ((course as { school_id?: string })?.school_id !== schoolId) continue;

    const { count } = await supabase
      .from("student_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("course_section_id", section.id)
      .eq("enrollment_status", "enrolled");

    const enrolled = count ?? 0;
    const openSeats = (section.max_capacity ?? 0) - enrolled;
    if (openSeats > 0 && enrolled > 0) {
      recommendations.push({
        priority: "low",
        category: "capacity",
        title: `Open seats in ${section.section_code}`,
        detail: `${openSeats} seats available (${enrolled}/${section.max_capacity} enrolled)`,
        action: "Review waitlist or promote section",
      });
    }
  }

  return recommendations.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

export async function processSchedulingIntelligenceQueue(supabase: AuthClient) {
  const { data: schools } = await supabase.from("schools").select("id").eq("status", "active");
  for (const school of schools ?? []) {
    await detectSchedulingConflicts(supabase, school.id);
    await syncConflictsToMissionControl(supabase, school.id);
  }
}
