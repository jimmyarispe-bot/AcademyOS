import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getStudentSchedule } from "@/lib/scheduling/queries";
import { computeStudentSuccessScore } from "@/lib/ssis/score";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getStudentSelfDashboard(supabase: AuthClient, studentId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [student, schedule, score, goals, attendance, events] = await Promise.all([
    supabase.from("students").select("*").eq("id", studentId).single(),
    getStudentSchedule(studentId),
    computeStudentSuccessScore(supabase, studentId),
    supabase
      .from("student_growth_goals")
      .select("*")
      .eq("student_id", studentId)
      .eq("status", "active")
      .limit(10),
    supabase
      .from("student_attendance_records")
      .select("*")
      .eq("student_id", studentId)
      .gte("attendance_date", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0])
      .order("attendance_date", { ascending: false }),
    supabase
      .from("academic_calendar_events")
      .select("*")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(10),
  ]);

  const todaySchedule = {
    sessions: (schedule.sessions ?? []).filter(
      (s) => (s as { scheduled_start?: string }).scheduled_start?.split("T")[0] === today
    ),
    services: (schedule.services ?? []).filter(
      (s) => (s as { scheduled_at?: string }).scheduled_at?.split("T")[0] === today
    ),
  };

  const presentDays = (attendance.data ?? []).filter((a) => a.status === "present").length;
  const attendanceRate = attendance.data?.length
    ? Math.round((presentDays / attendance.data.length) * 100)
    : null;

  return {
    student: student.data,
    todaySchedule,
    score,
    goals: goals.data ?? [],
    attendanceRate,
    upcomingEvents: events.data ?? [],
  };
}
