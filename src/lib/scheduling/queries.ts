import { createAuthClient } from "@/lib/supabase/server-auth";

export async function getSchedulingExecutiveStats(schoolId?: string) {
  const supabase = await createAuthClient();

  let sessionsQuery = supabase
    .from("instructional_sessions")
    .select("id, session_status, scheduled_start, course_sections(max_capacity, courses(school_id))")
    .gte("scheduled_start", new Date(Date.now() - 7 * 86400000).toISOString());

  const { data: sessions } = await sessionsQuery;
  const filtered = (sessions ?? []).filter((s) => {
    if (!schoolId) return true;
    const cs = Array.isArray(s.course_sections) ? s.course_sections[0] : s.course_sections;
    const c = cs?.courses;
    const course = Array.isArray(c) ? c[0] : c;
    return (course as { school_id?: string })?.school_id === schoolId;
  });

  let conflictsQuery = supabase
    .from("schedule_conflicts")
    .select("id")
    .eq("is_resolved", false);
  if (schoolId) conflictsQuery = conflictsQuery.eq("school_id", schoolId);
  const { data: conflicts } = await conflictsQuery;

  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, max_capacity, status, courses(school_id)")
    .eq("status", "open");

  const openSections = (sections ?? []).filter((s) => {
    if (!schoolId) return true;
    const c = Array.isArray(s.courses) ? s.courses[0] : s.courses;
    return (c as { school_id?: string })?.school_id === schoolId;
  });

  const scheduled = filtered.filter((s) => s.session_status === "scheduled").length;
  const completed = filtered.filter((s) => s.session_status === "completed").length;
  const openSeats = openSections.reduce((sum, s) => sum + (s.max_capacity ?? 0), 0);

  return {
    sessionsThisWeek: filtered.length,
    scheduledSessions: scheduled,
    completedSessions: completed,
    openConflicts: conflicts?.length ?? 0,
    openSections: openSections.length,
    openSeats,
    teacherUtilization: filtered.length ? Math.round((completed / filtered.length) * 100) : 0,
  };
}

export async function getCourses(schoolId?: string) {
  const supabase = await createAuthClient();
  let q = supabase.from("courses").select("*").order("name");
  if (schoolId) q = q.eq("school_id", schoolId);
  const { data } = await q;
  return data ?? [];
}

export async function getCourseSections(schoolId?: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("course_sections")
    .select("*, courses(id, name, code, school_id, academy_subject, delivery_mode, program), school_years(name), campuses(name)")
    .order("section_code");

  return (data ?? []).filter((s) => {
    if (!schoolId) return true;
    const c = Array.isArray(s.courses) ? s.courses[0] : s.courses;
    return c?.school_id === schoolId;
  });
}

export async function getUpcomingSessions(schoolId?: string, limit = 30) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("instructional_sessions")
    .select("*, course_sections(section_code, delivery_mode, courses(name, school_id))")
    .gte("scheduled_start", new Date().toISOString())
    .eq("session_status", "scheduled")
    .order("scheduled_start")
    .limit(limit);

  return (data ?? []).filter((s) => {
    if (!schoolId) return true;
    const cs = Array.isArray(s.course_sections) ? s.course_sections[0] : s.course_sections;
    const c = cs?.courses;
    const course = Array.isArray(c) ? c[0] : c;
    return (course as { school_id?: string })?.school_id === schoolId;
  });
}

export async function getScheduleRooms(schoolId?: string) {
  const supabase = await createAuthClient();
  let q = supabase.from("schedule_rooms").select("*").eq("status", "active").order("name");
  if (schoolId) q = q.eq("school_id", schoolId);
  const { data } = await q;
  return data ?? [];
}

export async function getScheduleConflicts(schoolId?: string) {
  const supabase = await createAuthClient();
  let q = supabase
    .from("schedule_conflicts")
    .select("*")
    .eq("is_resolved", false)
    .order("detected_at", { ascending: false })
    .limit(50);
  if (schoolId) q = q.eq("school_id", schoolId);
  const { data } = await q;
  return data ?? [];
}

export async function getAcademicCalendarEvents(schoolId: string, from: string, to: string) {
  const supabase = await createAuthClient();
  const { data: calendars } = await supabase
    .from("academic_calendars")
    .select("id, name, calendar_scope")
    .eq("school_id", schoolId)
    .eq("is_active", true);

  if (!calendars?.length) return [];

  const { data: events } = await supabase
    .from("academic_calendar_events")
    .select("*, academic_calendars(name, calendar_scope)")
    .in(
      "calendar_id",
      calendars.map((c) => c.id)
    )
    .gte("starts_at", `${from}T00:00:00`)
    .lte("starts_at", `${to}T23:59:59`)
    .order("starts_at");

  return events ?? [];
}

export async function getStudentSchedule(studentId: string) {
  const supabase = await createAuthClient();
  const { data: enrollments } = await supabase
    .from("student_enrollments")
    .select("course_section_id")
    .eq("student_id", studentId)
    .eq("enrollment_status", "enrolled");

  const sectionIds = (enrollments ?? []).map((e) => e.course_section_id);
  if (!sectionIds.length) return { sessions: [], services: [] };

  const [sessionsRes, servicesRes] = await Promise.all([
    supabase
      .from("instructional_sessions")
      .select("*, course_sections(section_code, courses(name))")
      .in("course_section_id", sectionIds)
      .gte("scheduled_start", new Date().toISOString())
      .order("scheduled_start")
      .limit(50),
    supabase
      .from("student_service_sessions")
      .select("*")
      .eq("student_id", studentId)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(20),
  ]);

  return {
    sessions: sessionsRes.data ?? [],
    services: servicesRes.data ?? [],
  };
}

export async function getStaffWorkload(schoolId: string) {
  const supabase = await createAuthClient();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const { data: employees } = await supabase
    .from("employees")
    .select("id, employee_type, employee_profiles(first_name, last_name)")
    .eq("school_id", schoolId)
    .eq("employment_status", "active");

  const workload = [];
  for (const emp of employees ?? []) {
    const { data: sessions } = await supabase
      .from("instructional_sessions")
      .select("id, scheduled_start, scheduled_end, session_type")
      .eq("instructor_employee_id", emp.id)
      .gte("scheduled_start", weekStart.toISOString());

    const hours =
      (sessions ?? []).reduce((sum, s) => {
        const ms = new Date(s.scheduled_end).getTime() - new Date(s.scheduled_start).getTime();
        return sum + ms / 3600000;
      }, 0) ?? 0;

    const profile = Array.isArray(emp.employee_profiles) ? emp.employee_profiles[0] : emp.employee_profiles;

    workload.push({
      employeeId: emp.id,
      name: profile ? `${profile.first_name} ${profile.last_name}` : "Staff",
      sessionCount: sessions?.length ?? 0,
      weeklyHours: Math.round(hours * 10) / 10,
      overloaded: hours > 30,
    });
  }

  return workload.sort((a, b) => b.weeklyHours - a.weeklyHours);
}
