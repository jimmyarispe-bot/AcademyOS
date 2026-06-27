import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getInstructionalQualityMetrics(
  supabase: AuthClient,
  employeeId: string
) {
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString();

  const [sessions, deliveries, attendanceSessions, goals, outreach, interventions] = await Promise.all([
    supabase
      .from("instructional_sessions")
      .select("id, session_status")
      .eq("instructor_employee_id", employeeId)
      .gte("scheduled_start", monthStartIso),
    supabase
      .from("instructional_session_deliveries")
      .select("lesson_status, instructional_sessions!inner(instructor_employee_id)")
      .eq("instructional_sessions.instructor_employee_id", employeeId),
    supabase
      .from("instructional_sessions")
      .select("id")
      .eq("instructor_employee_id", employeeId)
      .eq("session_status", "completed")
      .gte("scheduled_start", monthStartIso),
    supabase
      .from("student_growth_goals")
      .select("id, progress_pct, updated_at")
      .eq("assigned_employee_id", employeeId)
      .gte("updated_at", monthStartIso),
    supabase
      .from("teacher_parent_outreach")
      .select("id, status, sent_at, created_at")
      .eq("employee_id", employeeId)
      .gte("created_at", monthStartIso),
    supabase
      .from("student_academic_interventions")
      .select("id, status")
      .eq("assigned_employee_id", employeeId),
  ]);

  const sessionList = sessions.data ?? [];
  const completed = sessionList.filter((s) => s.session_status === "completed").length;
  const deliveryList = deliveries.data ?? [];
  const documented = deliveryList.filter((d) => d.lesson_status === "completed").length;

  const completedIds = (attendanceSessions.data ?? []).map((s) => s.id);
  let attendanceComplete = 0;
  if (completedIds.length) {
    const { count } = await supabase
      .from("session_attendance_records")
      .select("instructional_session_id", { count: "exact", head: true })
      .in("instructional_session_id", completedIds);
    attendanceComplete = count ?? 0;
  }

  const sentMessages = (outreach.data ?? []).filter((o) => o.status === "sent").length;
  const avgGoalProgress =
    (goals.data ?? []).length
      ? Math.round(
          (goals.data ?? []).reduce((s, g) => s + Number(g.progress_pct ?? 0), 0) / (goals.data ?? []).length
        )
      : 0;

  return {
    sessionsScheduled: sessionList.length,
    sessionsCompleted: completed,
    documentationRate: sessionList.length ? Math.round((documented / sessionList.length) * 100) : 0,
    attendanceCompletionRate: completedIds.length ? Math.round((attendanceComplete / completedIds.length) * 100) : 0,
    goalUpdates: goals.data?.length ?? 0,
    avgGoalProgress,
    parentMessagesSent: sentMessages,
    activeInterventions: (interventions.data ?? []).filter((i) => i.status === "active").length,
    interventionsCompleted: (interventions.data ?? []).filter((i) => i.status === "completed").length,
    parentResponseRate: (outreach.data ?? []).length
      ? Math.round((sentMessages / (outreach.data ?? []).length) * 100)
      : 0,
    complianceScore: Math.round(
      ((completed / Math.max(sessionList.length, 1)) * 0.4 +
        (documented / Math.max(sessionList.length, 1)) * 0.3 +
        (attendanceComplete / Math.max(completedIds.length, 1)) * 0.3) *
        100
    ),
  };
}

export async function getSchoolInstructionalQualitySummary(supabase: AuthClient, schoolId: string) {
  const { data: employees } = await supabase
    .from("employees")
    .select("id")
    .eq("school_id", schoolId)
    .eq("employment_status", "active")
    .in("employee_type", ["teacher", "contractor"]);

  const summaries = await Promise.all(
    (employees ?? []).slice(0, 20).map((e) => getInstructionalQualityMetrics(supabase, e.id))
  );

  const count = summaries.length || 1;
  return {
    staffCount: employees?.length ?? 0,
    avgDocumentationRate: Math.round(summaries.reduce((s, m) => s + m.documentationRate, 0) / count),
    avgAttendanceCompletion: Math.round(summaries.reduce((s, m) => s + m.attendanceCompletionRate, 0) / count),
    avgGoalProgress: Math.round(summaries.reduce((s, m) => s + m.avgGoalProgress, 0) / count),
    totalSessionsCompleted: summaries.reduce((s, m) => s + m.sessionsCompleted, 0),
    avgComplianceScore: Math.round(summaries.reduce((s, m) => s + m.complianceScore, 0) / count),
  };
}
