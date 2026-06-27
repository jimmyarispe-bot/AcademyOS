import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getAcademicCalendarEvents } from "@/lib/scheduling/queries";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface PortalCalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  category: string;
  studentId?: string;
  studentName?: string;
  href?: string;
}

export async function getFamilyCalendarEvents(
  supabase: AuthClient,
  studentIds: string[],
  from: string,
  to: string
): Promise<PortalCalendarEvent[]> {
  if (!studentIds.length) return [];

  const events: PortalCalendarEvent[] = [];
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, school_id, family_id")
    .in("id", studentIds);

  const schoolIds = [...new Set((students ?? []).map((s) => s.school_id))];
  const studentMap = new Map((students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`]));

  for (const schoolId of schoolIds) {
    const calEvents = await getAcademicCalendarEvents(schoolId, from, to);
    for (const e of calEvents) {
      events.push({
        id: `cal-${e.id}`,
        title: e.title as string,
        start: e.starts_at as string,
        end: (e.ends_at as string) ?? undefined,
        category: (e.event_type as string) ?? "school_event",
      });
    }
  }

  const { data: enrollments } = await supabase
    .from("student_enrollments")
    .select("student_id, course_section_id")
    .in("student_id", studentIds)
    .eq("enrollment_status", "enrolled");

  const sectionIds = [...new Set((enrollments ?? []).map((e) => e.course_section_id))];
  if (sectionIds.length) {
    const { data: sessions } = await supabase
      .from("instructional_sessions")
      .select("*, course_sections(section_code, courses(name))")
      .in("course_section_id", sectionIds)
      .gte("scheduled_start", `${from}T00:00:00`)
      .lte("scheduled_start", `${to}T23:59:59`)
      .order("scheduled_start");

    for (const s of sessions ?? []) {
      const enrollment = enrollments?.find((e) => e.course_section_id === s.course_section_id);
      const cs = Array.isArray(s.course_sections) ? s.course_sections[0] : s.course_sections;
      const course = cs?.courses;
      const courseName = Array.isArray(course) ? course[0]?.name : course?.name;
      events.push({
        id: `session-${s.id}`,
        title: courseName ?? cs?.section_code ?? "Class",
        start: s.scheduled_start,
        end: s.scheduled_end,
        category: "class",
        studentId: enrollment?.student_id,
        studentName: enrollment?.student_id ? studentMap.get(enrollment.student_id) : undefined,
        href: enrollment?.student_id ? `/portal/students/${enrollment.student_id}` : undefined,
      });
    }
  }

  const { data: services } = await supabase
    .from("student_service_sessions")
    .select("*")
    .in("student_id", studentIds)
    .gte("scheduled_at", `${from}T00:00:00`)
    .lte("scheduled_at", `${to}T23:59:59`);

  for (const svc of services ?? []) {
    events.push({
      id: `service-${svc.id}`,
      title: `${svc.service_type ?? "Service"} session`,
      start: svc.scheduled_at,
      category: "therapy",
      studentId: svc.student_id,
      studentName: studentMap.get(svc.student_id),
    });
  }

  const { data: meetings } = await supabase
    .from("student_instructional_meetings")
    .select("*")
    .in("student_id", studentIds)
    .eq("parent_visible", true)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", `${from}T00:00:00`)
    .lte("scheduled_at", `${to}T23:59:59`);

  for (const m of meetings ?? []) {
    events.push({
      id: `meeting-${m.id}`,
      title: m.title,
      start: m.scheduled_at,
      category: "conference",
      studentId: m.student_id,
      studentName: studentMap.get(m.student_id),
      href: "/portal/conferences",
    });
  }

  const familyIds = [...new Set((students ?? []).map((s) => s.family_id).filter(Boolean))] as string[];
  if (familyIds.length) {
    const { data: accounts } = await supabase
      .from("family_billing_accounts")
      .select("id")
      .in("family_id", familyIds);

    if (accounts?.length) {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, due_date, billing_account_id")
        .in(
          "billing_account_id",
          accounts.map((a) => a.id)
        )
        .gte("due_date", from)
        .lte("due_date", to)
        .neq("invoice_status", "paid");

      for (const inv of invoices ?? []) {
        events.push({
          id: `invoice-${inv.id}`,
          title: `Payment due: ${inv.invoice_number}`,
          start: `${inv.due_date}T09:00:00`,
          category: "financial",
          href: "/portal/finance",
        });
      }
    }
  }

  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export function buildIcsCalendar(events: PortalCalendarEvent[], calendarName: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AcademyOS//Family Calendar//EN",
    `X-WR-CALNAME:${calendarName}`,
  ];

  for (const e of events) {
    const start = new Date(e.start).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = e.end
      ? new Date(e.end).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
      : start;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@academyos`);
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${e.title.replace(/,/g, "\\,")}`);
    lines.push(`CATEGORIES:${e.category}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
