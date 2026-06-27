import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getStudentProgressCenter(supabase: AuthClient, studentId: string) {
  const [
    assessments,
    observations,
    interventions,
    goals,
    artifacts,
  ] = await Promise.all([
    supabase
      .from("student_academic_assessments")
      .select("*")
      .eq("student_id", studentId)
      .order("assessed_on", { ascending: false })
      .limit(20),
    supabase
      .from("ssis_academic_observations")
      .select("*")
      .eq("student_id", studentId)
      .order("observed_at", { ascending: false })
      .limit(15),
    supabase
      .from("student_academic_interventions")
      .select("*")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("student_growth_goals")
      .select("*")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("student_learning_artifacts")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const byDomain: Record<string, typeof assessments.data> = {};
  for (const a of assessments.data ?? []) {
    const domain = a.subject_domain ?? a.assessment_type ?? "general";
    byDomain[domain] = [...(byDomain[domain] ?? []), a];
  }

  return {
    assessments: assessments.data ?? [],
    byDomain,
    observations: observations.data ?? [],
    interventions: interventions.data ?? [],
    goals: goals.data ?? [],
    artifacts: artifacts.data ?? [],
  };
}
