import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getOrganizationInterventionEffectiveness } from "@/lib/instruction/effectiveness";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getExecutiveInstructionDashboard(supabase: AuthClient, schoolId?: string) {
  let employeesQuery = supabase
    .from("employees")
    .select("id, employee_type, school_id")
    .eq("employment_status", "active")
    .in("employee_type", ["teacher", "contractor"]);

  if (schoolId) employeesQuery = employeesQuery.eq("school_id", schoolId);
  const { data: employees } = await employeesQuery;

  const monthStart = new Date();
  monthStart.setDate(1);

  const { data: allSessions } = await supabase
    .from("instructional_sessions")
    .select("id, session_status, instructor_employee_id, scheduled_start, scheduled_end, course_sections(courses(program, academy_subject, school_id, campuses(name)))")
    .gte("scheduled_start", monthStart.toISOString());

  const empIds = new Set((employees ?? []).map((e) => e.id));
  const sessions = (allSessions ?? []).filter((s) => empIds.has(s.instructor_employee_id));

  const completed = sessions.filter((s) => s.session_status === "completed").length;
  const hours = sessions.reduce(
    (sum, s) => sum + (new Date(s.scheduled_end).getTime() - new Date(s.scheduled_start).getTime()) / 3600000,
    0
  );

  const { data: goals } = await supabase.from("student_growth_goals").select("progress_pct, status, student_id, students(school_id, grade_level, campus_id, campuses(name))");
  const filteredGoals = (goals ?? []).filter((g) => {
    if (!schoolId) return true;
    const st = Array.isArray(g.students) ? g.students[0] : g.students;
    return (st as { school_id?: string })?.school_id === schoolId;
  });

  const avgGrowth =
    filteredGoals.length
      ? Math.round(filteredGoals.reduce((s, g) => s + Number(g.progress_pct ?? 0), 0) / filteredGoals.length)
      : 0;

  const interventionStats = await getOrganizationInterventionEffectiveness(supabase, schoolId);

  let teamsQuery = supabase.from("student_instructional_teams").select("id", { count: "exact", head: true });
  if (schoolId) teamsQuery = teamsQuery.eq("school_id", schoolId);
  const { count: teamCount } = await teamsQuery;

  const { count: openGoals } = await supabase
    .from("student_growth_goals")
    .select("id", { count: "exact", head: true })
    .eq("status", "at_risk");

  const { data: deliveries } = await supabase
    .from("instructional_session_deliveries")
    .select("lesson_status, instructional_sessions!inner(instructor_employee_id, scheduled_start)")
    .gte("instructional_sessions.scheduled_start", monthStart.toISOString());

  const schoolDeliveries = (deliveries ?? []).filter((d) => {
    const sess = Array.isArray(d.instructional_sessions) ? d.instructional_sessions[0] : d.instructional_sessions;
    return empIds.has((sess as { instructor_employee_id?: string })?.instructor_employee_id ?? "");
  });
  const documented = schoolDeliveries.filter((d) => d.lesson_status === "completed").length;

  const programBreakdown: Record<string, number> = {};
  const gradeBreakdown: Record<string, number> = {};
  for (const g of filteredGoals) {
    const st = Array.isArray(g.students) ? g.students[0] : g.students;
    const grade = (st as { grade_level?: string })?.grade_level ?? "Unknown";
    gradeBreakdown[grade] = (gradeBreakdown[grade] ?? 0) + 1;
  }
  for (const s of sessions) {
    const cs = Array.isArray(s.course_sections) ? s.course_sections[0] : s.course_sections;
    const course = cs?.courses;
    const c = Array.isArray(course) ? course[0] : course;
    const program = (c as { program?: string })?.program ?? "General";
    programBreakdown[program] = (programBreakdown[program] ?? 0) + 1;
  }

  const caseloads = (employees ?? []).length
    ? Math.round(filteredGoals.length / (employees?.length ?? 1))
    : 0;

  return {
    activeTeachers: employees?.length ?? 0,
    sessionsThisMonth: sessions.length,
    sessionsCompleted: completed,
    instructionalHours: Math.round(hours),
    avgGoalProgress: avgGrowth,
    goalsAtRisk: openGoals ?? 0,
    instructionalTeams: teamCount ?? 0,
    interventionEffectiveness: interventionStats,
    completionRate: sessions.length ? Math.round((completed / sessions.length) * 100) : 0,
    documentationRate: sessions.length ? Math.round((documented / sessions.length) * 100) : 0,
    avgCaseloadGoals: caseloads,
    programBreakdown,
    gradeBreakdown,
  };
}
