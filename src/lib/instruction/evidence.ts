import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface EvidenceFilters {
  studentId?: string;
  goalId?: string;
  employeeId?: string;
  interventionId?: string;
  sessionId?: string;
  subjectDomain?: string;
  dateFrom?: string;
  dateTo?: string;
  artifactType?: string;
  query?: string;
}

export async function searchEvidenceLibrary(supabase: AuthClient, filters: EvidenceFilters) {
  let q = supabase
    .from("student_learning_artifacts")
    .select("*, students(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (filters.studentId) q = q.eq("student_id", filters.studentId);
  if (filters.goalId) q = q.eq("growth_goal_id", filters.goalId);
  if (filters.employeeId) q = q.eq("recorded_by_employee_id", filters.employeeId);
  if (filters.interventionId) q = q.eq("intervention_id", filters.interventionId);
  if (filters.sessionId) q = q.eq("instructional_session_id", filters.sessionId);
  if (filters.subjectDomain) q = q.eq("subject_domain", filters.subjectDomain);
  if (filters.artifactType) q = q.eq("artifact_type", filters.artifactType);
  if (filters.dateFrom) q = q.gte("created_at", `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) q = q.lte("created_at", `${filters.dateTo}T23:59:59`);

  const { data } = await q;
  let results = data ?? [];

  if (filters.query) {
    const needle = filters.query.toLowerCase();
    results = results.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        (r.description as string | null)?.toLowerCase().includes(needle) ||
        (r.learning_objective as string | null)?.toLowerCase().includes(needle)
    );
  }

  return results;
}

export async function getProgressVisualizationData(supabase: AuthClient, studentId: string) {
  const [progress, literacy, attendance, goals, interventions] = await Promise.all([
    supabase
      .from("student_academic_progress_records")
      .select("domain, current_level, assessment_date, growth_summary")
      .eq("student_id", studentId)
      .order("assessment_date", { ascending: true }),
    supabase
      .from("structured_literacy_progress")
      .select("literacy_level, literacy_step, mastery_date, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true }),
    supabase
      .from("student_attendance_records")
      .select("attendance_date, status")
      .eq("student_id", studentId)
      .order("attendance_date", { ascending: true })
      .limit(90),
    supabase
      .from("student_growth_goals")
      .select("title, goal_source, progress_pct, status, review_date")
      .eq("student_id", studentId)
      .neq("status", "discontinued"),
    supabase
      .from("intervention_effectiveness_records")
      .select("*, student_academic_interventions(intervention_type)")
      .eq("student_id", studentId)
      .order("recorded_at", { ascending: true }),
  ]);

  return {
    academicProgress: progress.data ?? [],
    structuredLiteracy: literacy.data ?? [],
    attendance: attendance.data ?? [],
    goals: goals.data ?? [],
    interventionEffectiveness: interventions.data ?? [],
  };
}
