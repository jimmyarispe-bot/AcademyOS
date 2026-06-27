import type { createAuthClient } from "@/lib/supabase/server-auth";
import { formatAcademyTime } from "@/lib/scheduling/academy-way";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getTeacherEmployeeId(supabase: AuthClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .eq("employment_status", "active")
    .maybeSingle();
  return data?.id ?? null;
}

function todayRange(): { start: string; end: string } {
  const d = new Date();
  const dateStr = d.toISOString().split("T")[0];
  return { start: `${dateStr}T00:00:00`, end: `${dateStr}T23:59:59` };
}

export async function getTeacherTodaySessions(supabase: AuthClient, employeeId: string) {
  const { start, end } = todayRange();

  const { data: sessions } = await supabase
    .from("instructional_sessions")
    .select(`
      *,
      instructional_session_deliveries(lesson_status, session_notes),
      schedule_rooms:room_id(name),
      course_sections(
        section_code, delivery_mode, structured_literacy_level, structured_literacy_step, academy_level,
        courses(name, code, academy_subject, program, delivery_mode)
      )
    `)
    .eq("instructor_employee_id", employeeId)
    .gte("scheduled_start", start)
    .lte("scheduled_start", end)
    .order("scheduled_start");

  const sessionList = sessions ?? [];

  const enriched = [];
  for (const session of sessionList) {
    const cs = Array.isArray(session.course_sections) ? session.course_sections[0] : session.course_sections;
    const sectionId = session.course_section_id;

    const { data: enrollments } = await supabase
      .from("student_enrollments")
      .select("student_id, students(id, first_name, last_name, grade_level)")
      .eq("course_section_id", sectionId)
      .eq("enrollment_status", "enrolled");

    const studentIds = (enrollments ?? []).map((e) => e.student_id);

    const { data: attendance } = studentIds.length
      ? await supabase
          .from("session_attendance_records")
          .select("student_id, attendance_status")
          .eq("instructional_session_id", session.id)
          .in("student_id", studentIds)
      : { data: [] };

    const attendanceMap = new Map((attendance ?? []).map((a) => [a.student_id, a.attendance_status]));

    const alerts = await getStudentAlertsForSession(supabase, studentIds);

    const deliveryRaw = session.instructional_session_deliveries;
    const delivery = Array.isArray(deliveryRaw) ? deliveryRaw[0] : deliveryRaw;
    const room = Array.isArray(session.schedule_rooms) ? session.schedule_rooms[0] : session.schedule_rooms;

    enriched.push({
      ...session,
      students: (enrollments ?? []).map((e) => {
        const st = Array.isArray(e.students) ? e.students[0] : e.students;
        return {
          id: e.student_id,
          ...(st as Record<string, unknown>),
          attendanceStatus: attendanceMap.get(e.student_id) ?? "pending",
        };
      }),
      alerts,
      lessonStatus: (delivery as { lesson_status?: string } | null)?.lesson_status ?? "not_started",
      roomName: (room as { name?: string } | null)?.name ?? null,
      course: Array.isArray(cs?.courses) ? cs.courses[0] : cs?.courses,
      section: cs,
      timeDisplay:
        session.time_display ??
        `${formatAcademyTime(session.scheduled_start)} – ${formatAcademyTime(session.scheduled_end)}`,
    });
  }

  return enriched;
}

async function getStudentAlertsForSession(supabase: AuthClient, studentIds: string[]) {
  if (!studentIds.length) return [];

  const alerts: { studentId: string; type: string; message: string }[] = [];

  const [medical, sped, behavior, funding] = await Promise.all([
    supabase
      .from("student_medical_profiles")
      .select("student_id, health_alerts, allergies")
      .in("student_id", studentIds),
    supabase
      .from("student_special_education_plans")
      .select("student_id, plan_type, status, accommodations")
      .in("student_id", studentIds)
      .eq("status", "active"),
    supabase
      .from("student_behavior_events")
      .select("student_id, title, event_type")
      .in("student_id", studentIds)
      .gte("occurred_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(20),
    supabase
      .from("ssis_student_funding_records")
      .select("student_id, verification_status")
      .in("student_id", studentIds)
      .eq("verification_status", "pending"),
  ]);

  for (const sid of studentIds) {
    const med = (medical.data ?? []).find((m) => m.student_id === sid);
    if (med?.health_alerts && Array.isArray(med.health_alerts) && med.health_alerts.length) {
      alerts.push({ studentId: sid, type: "medical", message: "Active health alerts on file" });
    }
    const iep = (sped.data ?? []).find((p) => p.student_id === sid);
    if (iep) {
      alerts.push({ studentId: sid, type: "iep", message: `${iep.plan_type} active — review accommodations` });
    }
    const recentBehavior = (behavior.data ?? []).filter((b) => b.student_id === sid);
    if (recentBehavior.length) {
      alerts.push({ studentId: sid, type: "behavior", message: `${recentBehavior.length} recent behavior event(s)` });
    }
    const fund = (funding.data ?? []).find((f) => f.student_id === sid);
    if (fund) {
      alerts.push({ studentId: sid, type: "funding", message: "Funding verification pending" });
    }
  }

  return alerts;
}

export async function getSessionWorkspace(supabase: AuthClient, sessionId: string) {
  const { data: session } = await supabase
    .from("instructional_sessions")
    .select(`
      *,
      instructional_session_deliveries(*),
      schedule_rooms:room_id(name, room_type),
      course_sections(
        *, courses(name, code, academy_subject, program, delivery_mode, school_id)
      )
    `)
    .eq("id", sessionId)
    .single();

  if (!session) return null;

  const { data: enrollments } = await supabase
    .from("student_enrollments")
    .select("student_id, students(*)")
    .eq("course_section_id", session.course_section_id)
    .eq("enrollment_status", "enrolled");

  const studentIds = (enrollments ?? []).map((e) => e.student_id);

  const [attendance, studentRecords, assessments, artifacts] = await Promise.all([
    supabase
      .from("session_attendance_records")
      .select("*")
      .eq("instructional_session_id", sessionId),
    supabase
      .from("instructional_session_student_records")
      .select("*")
      .eq("instructional_session_id", sessionId),
    supabase
      .from("session_assessment_records")
      .select("*")
      .eq("instructional_session_id", sessionId),
    studentIds.length
      ? supabase
          .from("student_learning_artifacts")
          .select("*")
          .eq("instructional_session_id", sessionId)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    session,
    students: enrollments ?? [],
    attendance: attendance.data ?? [],
    studentRecords: studentRecords.data ?? [],
    assessments: assessments.data ?? [],
    artifacts: artifacts.data ?? [],
    delivery: Array.isArray(session.instructional_session_deliveries)
      ? session.instructional_session_deliveries[0]
      : session.instructional_session_deliveries,
  };
}

export async function getTeacherWorkloadSummary(supabase: AuthClient, employeeId: string) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const { start, end } = todayRange();

  const [todaySessions, weekSessions, interventions, outreach, missionItems] = await Promise.all([
    supabase
      .from("instructional_sessions")
      .select("id", { count: "exact", head: true })
      .eq("instructor_employee_id", employeeId)
      .gte("scheduled_start", start)
      .lte("scheduled_start", end),
    supabase
      .from("instructional_sessions")
      .select("id, session_status, scheduled_start, scheduled_end")
      .eq("instructor_employee_id", employeeId)
      .gte("scheduled_start", weekStart.toISOString()),
    supabase
      .from("student_academic_interventions")
      .select("id", { count: "exact", head: true })
      .eq("assigned_employee_id", employeeId)
      .eq("status", "active"),
    supabase
      .from("teacher_parent_outreach")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .eq("status", "draft"),
    supabase
      .from("platform_mission_control_items")
      .select("id", { count: "exact", head: true })
      .eq("is_resolved", false)
      .eq("module", "teacher_portal"),
  ]);

  const weekList = weekSessions.data ?? [];
  const hours = weekList.reduce((sum, s) => {
    return sum + (new Date(s.scheduled_end).getTime() - new Date(s.scheduled_start).getTime()) / 3600000;
  }, 0);

  const { data: todaySessionIds } = await supabase
    .from("instructional_sessions")
    .select("id")
    .eq("instructor_employee_id", employeeId)
    .gte("scheduled_start", start)
    .lte("scheduled_start", end);

  const ids = (todaySessionIds ?? []).map((s) => s.id);
  let pendingAttendance = ids.length;
  if (ids.length) {
    const { count } = await supabase
      .from("session_attendance_records")
      .select("id", { count: "exact", head: true })
      .in("instructional_session_id", ids);
    pendingAttendance = Math.max(0, ids.length - (count ?? 0));
  }

  return {
    sessionsToday: todaySessions.count ?? 0,
    sessionsThisWeek: weekList.length,
    weeklyHours: Math.round(hours * 10) / 10,
    activeInterventions: interventions.count ?? 0,
    draftMessages: outreach.count ?? 0,
    missionControlAlerts: missionItems.count ?? 0,
    pendingAttendanceSessions: pendingAttendance,
    ...(await getTeacherExtendedWorkload(supabase, employeeId)),
  };
}

async function getTeacherExtendedWorkload(supabase: AuthClient, employeeId: string) {
  const { data: emp } = await supabase.from("employees").select("user_id").eq("id", employeeId).single();

  const { data: sections } = await supabase
    .from("course_sections")
    .select("id")
    .eq("instructor_employee_id", employeeId);

  const sectionIds = (sections ?? []).map((s) => s.id);
  let studentsServed = 0;
  if (sectionIds.length) {
    const { data: enrollments } = await supabase
      .from("student_enrollments")
      .select("student_id")
      .in("course_section_id", sectionIds)
      .eq("enrollment_status", "enrolled");
    studentsServed = new Set((enrollments ?? []).map((e) => e.student_id)).size;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  let serviceMinutes = 0;
  if (emp?.user_id) {
    const { data: serviceSessions } = await supabase
      .from("student_service_sessions")
      .select("duration_minutes")
      .eq("provider_user_id", emp.user_id)
      .gte("scheduled_at", monthStart.toISOString());
    serviceMinutes = (serviceSessions ?? []).reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  }

  const { count: sentMessages } = await supabase
    .from("teacher_parent_outreach")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)
    .eq("status", "sent");

  return {
    studentsServed,
    serviceMinutes,
    sentParentMessages: sentMessages ?? 0,
  };
}

export async function getTeacherComplianceItems(supabase: AuthClient, employeeId: string) {
  const items: { type: string; severity: string; title: string; href?: string }[] = [];
  const { start, end } = todayRange();

  const { data: todaySessions } = await supabase
    .from("instructional_sessions")
    .select("id, scheduled_end, course_sections(section_code)")
    .eq("instructor_employee_id", employeeId)
    .gte("scheduled_start", start)
    .lte("scheduled_start", end);

  for (const s of todaySessions ?? []) {
    const cs = Array.isArray(s.course_sections) ? s.course_sections[0] : s.course_sections;
    const sectionCode = (cs as { section_code?: string })?.section_code ?? "session";

    const { count: attCount } = await supabase
      .from("session_attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("instructional_session_id", s.id);

    if (!attCount) {
      items.push({
        type: "attendance",
        severity: new Date(s.scheduled_end) < new Date() ? "high" : "medium",
        title: `Missing attendance — ${sectionCode}`,
        href: `/dashboard/teacher/sessions/${s.id}`,
      });
    }

    const { data: delivery } = await supabase
      .from("instructional_session_deliveries")
      .select("lesson_status")
      .eq("instructional_session_id", s.id)
      .maybeSingle();

    if (delivery?.lesson_status !== "completed" && new Date(s.scheduled_end) < new Date()) {
      items.push({
        type: "documentation",
        severity: "medium",
        title: `Incomplete session notes — ${sectionCode}`,
        href: `/dashboard/teacher/sessions/${s.id}`,
      });
    }
  }

  const { data: interventions } = await supabase
    .from("student_academic_interventions")
    .select("id, review_date, intervention_type, students(first_name, last_name)")
    .eq("assigned_employee_id", employeeId)
    .eq("status", "active")
    .lte("review_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);

  for (const iv of interventions ?? []) {
    const st = Array.isArray(iv.students) ? iv.students[0] : iv.students;
    items.push({
      type: "intervention",
      severity: "medium",
      title: `Intervention review due — ${(st as { first_name?: string })?.first_name ?? "student"}`,
    });
  }

  const { data: emp } = await supabase.from("employees").select("user_id").eq("id", employeeId).single();
  if (emp?.user_id) {
    const { data: missedServices } = await supabase
      .from("student_service_sessions")
      .select("id, service_type, students(first_name, last_name)")
      .eq("provider_user_id", emp.user_id)
      .eq("session_status", "scheduled")
      .lt("scheduled_at", new Date().toISOString())
      .limit(5);

    for (const svc of missedServices ?? []) {
      const st = Array.isArray(svc.students) ? svc.students[0] : svc.students;
      items.push({
        type: "service_minutes",
        severity: "high",
        title: `Incomplete service session — ${(st as { first_name?: string })?.first_name ?? "student"} (${svc.service_type})`,
      });
    }
  }

  const { data: sectionIds } = await supabase
    .from("course_sections")
    .select("id")
    .eq("instructor_employee_id", employeeId);

  const sids = (sectionIds ?? []).map((s) => s.id);
  if (sids.length) {
    const { data: enrollments } = await supabase
      .from("student_enrollments")
      .select("student_id")
      .in("course_section_id", sids)
      .eq("enrollment_status", "enrolled");

    const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id))];
    if (studentIds.length) {
      const { data: spedPlans } = await supabase
        .from("student_special_education_plans")
        .select("student_id, plan_type, annual_review_date, students(first_name, last_name)")
        .in("student_id", studentIds)
        .eq("status", "active")
        .lte("annual_review_date", new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);

      for (const plan of spedPlans ?? []) {
        const st = Array.isArray(plan.students) ? plan.students[0] : plan.students;
        items.push({
          type: "iep",
          severity: "high",
          title: `IEP review approaching — ${(st as { first_name?: string })?.first_name ?? "student"} (${plan.plan_type})`,
          href: `/dashboard/students/${plan.student_id}?tab=sped`,
        });
      }

      const { data: medical } = await supabase
        .from("student_medical_profiles")
        .select("student_id, health_alerts, students(first_name, last_name)")
        .in("student_id", studentIds);

      for (const m of medical ?? []) {
        if (m.health_alerts && Array.isArray(m.health_alerts) && m.health_alerts.length) {
          const st = Array.isArray(m.students) ? m.students[0] : m.students;
          items.push({
            type: "medical",
            severity: "medium",
            title: `Medical alert — ${(st as { first_name?: string })?.first_name ?? "student"}`,
            href: `/dashboard/students/${m.student_id}?tab=medical`,
          });
        }
      }
    }
  }

  return items;
}

export async function getStudentProgressHistory(supabase: AuthClient, studentId: string, domain: string) {
  const { data } = await supabase
    .from("student_academic_progress_records")
    .select("*")
    .eq("student_id", studentId)
    .eq("domain", domain)
    .order("assessment_date", { ascending: true });
  return data ?? [];
}

export async function getStructuredLiteracyHistory(supabase: AuthClient, studentId: string) {
  const { data } = await supabase
    .from("structured_literacy_progress")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getTeacherLessonPlans(supabase: AuthClient, employeeId: string) {
  const { data } = await supabase
    .from("teacher_lesson_plans")
    .select("*")
    .eq("employee_id", employeeId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function getTeacherNotes(
  supabase: AuthClient,
  employeeId: string,
  options?: { query?: string; category?: string }
) {
  let q = supabase
    .from("teacher_instructional_notes")
    .select("*, students(first_name, last_name)")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (options?.category) q = q.eq("category", options.category);

  const { data } = await q;
  let notes = data ?? [];

  if (options?.query) {
    const needle = options.query.toLowerCase();
    notes = notes.filter(
      (n) =>
        n.title.toLowerCase().includes(needle) ||
        n.body.toLowerCase().includes(needle) ||
        (n.tags as string[]).some((t) => t.toLowerCase().includes(needle))
    );
  }

  return notes;
}

export async function getAiReadinessConfig(supabase: AuthClient, schoolId: string) {
  const { data } = await supabase
    .from("teacher_ai_readiness_config")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();
  return data;
}

export async function getTeacherRosterStudents(supabase: AuthClient, employeeId: string) {
  const { data: sections } = await supabase
    .from("course_sections")
    .select("id")
    .eq("instructor_employee_id", employeeId);

  const sectionIds = (sections ?? []).map((s) => s.id);
  if (!sectionIds.length) return [];

  const { data: enrollments } = await supabase
    .from("student_enrollments")
    .select("student_id, students(id, first_name, last_name, grade_level)")
    .in("course_section_id", sectionIds)
    .eq("enrollment_status", "enrolled");

  const byId = new Map<string, Record<string, unknown>>();
  for (const e of enrollments ?? []) {
    const st = Array.isArray(e.students) ? e.students[0] : e.students;
    if (st) byId.set(e.student_id, { id: e.student_id, ...(st as Record<string, unknown>) });
  }
  return [...byId.values()];
}

export async function getTeacherInterventions(supabase: AuthClient, employeeId: string) {
  const { data } = await supabase
    .from("student_academic_interventions")
    .select("*, students(first_name, last_name)")
    .eq("assigned_employee_id", employeeId)
    .eq("status", "active")
    .order("review_date", { ascending: true });
  return data ?? [];
}

export async function getTeacherOutreachHistory(supabase: AuthClient, employeeId: string) {
  const { data } = await supabase
    .from("teacher_parent_outreach")
    .select("*, students(first_name, last_name)")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}
