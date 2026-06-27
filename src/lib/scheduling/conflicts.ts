import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { validateSectionAgainstAcademyWay, type AcademySubject } from "@/lib/scheduling/academy-way";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface ScheduleConflict {
  conflictType: string;
  severity: string;
  title: string;
  description: string;
  recommendation?: string;
  entityType: string;
  entityId: string;
}

export async function detectSchedulingConflicts(
  supabase: AuthClient,
  schoolId: string
): Promise<ScheduleConflict[]> {
  const conflicts: ScheduleConflict[] = [];

  const { data: sessions } = await supabase
    .from("instructional_sessions")
    .select(
      "id, scheduled_start, scheduled_end, instructor_employee_id, room_id, course_section_id, course_sections(max_capacity, min_capacity, delivery_mode, courses(school_id, academy_subject))"
    )
    .gte("scheduled_start", new Date().toISOString())
    .eq("session_status", "scheduled")
    .limit(200);

  const schoolSessions = (sessions ?? []).filter((s) => {
    const cs = Array.isArray(s.course_sections) ? s.course_sections[0] : s.course_sections;
    const c = cs?.courses;
    const course = Array.isArray(c) ? c[0] : c;
    return (course as { school_id?: string })?.school_id === schoolId;
  });

  // Teacher double-booking
  const byTeacher = new Map<string, typeof schoolSessions>();
  for (const s of schoolSessions) {
    const key = s.instructor_employee_id;
    if (!byTeacher.has(key)) byTeacher.set(key, []);
    byTeacher.get(key)!.push(s);
  }
  for (const [empId, list] of byTeacher) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (timesOverlap(list[i], list[j])) {
          conflicts.push({
            conflictType: "teacher",
            severity: "critical",
            title: "Teacher scheduling conflict",
            description: "Instructor assigned to overlapping sessions",
            recommendation: "Reschedule one session or assign a substitute",
            entityType: "employee",
            entityId: empId,
          });
        }
      }
    }
  }

  // Room double-booking
  const byRoom = new Map<string, typeof schoolSessions>();
  for (const s of schoolSessions.filter((x) => x.room_id)) {
    const key = s.room_id as string;
    if (!byRoom.has(key)) byRoom.set(key, []);
    byRoom.get(key)!.push(s);
  }
  for (const [roomId, list] of byRoom) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (timesOverlap(list[i], list[j])) {
          conflicts.push({
            conflictType: "room",
            severity: "critical",
            title: "Room scheduling conflict",
            description: "Room double-booked",
            recommendation: "Assign a different room or reschedule",
            entityType: "schedule_rooms",
            entityId: roomId,
          });
        }
      }
    }
  }

  // Academy Way capacity
  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, min_capacity, max_capacity, delivery_mode, courses(academy_subject, school_id)")
    .limit(100);

  for (const section of sections ?? []) {
    const course = Array.isArray(section.courses) ? section.courses[0] : section.courses;
    if ((course as { school_id?: string })?.school_id !== schoolId) continue;

    const { count } = await supabase
      .from("student_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("course_section_id", section.id)
      .eq("enrollment_status", "enrolled");

    const validation = validateSectionAgainstAcademyWay({
      academySubject: (course as { academy_subject?: AcademySubject })?.academy_subject,
      deliveryMode: section.delivery_mode,
      minCapacity: section.min_capacity,
      maxCapacity: section.max_capacity,
      enrolledCount: count ?? 0,
    });

    if (!validation.valid) {
      conflicts.push({
        conflictType: "academy_way",
        severity: "warning",
        title: "Academy Way rule violation",
        description: validation.errors.join("; "),
        recommendation: "Adjust enrollment or section configuration",
        entityType: "course_sections",
        entityId: section.id,
      });
    }
  }

  // Persist unresolved conflicts (skip duplicates from recent scans)
  for (const c of conflicts) {
    const { data: existing } = await supabase
      .from("schedule_conflicts")
      .select("id")
      .eq("school_id", schoolId)
      .eq("entity_type", c.entityType)
      .eq("entity_id", c.entityId)
      .eq("conflict_type", c.conflictType)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existing) continue;

    await supabase.from("schedule_conflicts").insert({
      school_id: schoolId,
      conflict_type: c.conflictType,
      severity: c.severity,
      entity_type: c.entityType,
      entity_id: c.entityId,
      title: c.title,
      description: c.description,
      recommendation: c.recommendation ?? null,
    });
  }

  return conflicts;
}

function timesOverlap(
  a: { scheduled_start: string; scheduled_end: string },
  b: { scheduled_start: string; scheduled_end: string }
): boolean {
  const aStart = new Date(a.scheduled_start).getTime();
  const aEnd = new Date(a.scheduled_end).getTime();
  const bStart = new Date(b.scheduled_start).getTime();
  const bEnd = new Date(b.scheduled_end).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export async function syncConflictsToMissionControl(supabase: AuthClient, schoolId: string) {
  const { data: open } = await supabase
    .from("schedule_conflicts")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_resolved", false)
    .eq("severity", "critical")
    .limit(10);

  for (const c of open ?? []) {
    await createMissionControlItem(supabase, {
      schoolId,
      module: "scheduling",
      itemType: "scheduling_alert",
      title: c.title,
      body: c.description ?? "",
      entityType: c.entity_type,
      entityId: c.entity_id,
      href: "/dashboard/scheduling?view=intelligence",
      severity: "high",
    });
  }
}
