import type { createAuthClient } from "@/lib/supabase/server-auth";
import {
  academyVirtualEndTime,
  formatAcademyTime,
  type AcademySubject,
} from "@/lib/scheduling/academy-way";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface GenerateSessionsInput {
  sectionId: string;
  dateFrom: string;
  dateTo: string;
  generatedBy?: string | null;
}

const DAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

export async function generateSectionSessions(
  supabase: AuthClient,
  input: GenerateSessionsInput
): Promise<{ created: number; skipped: number; runId?: string; error?: string }> {
  const { data: section } = await supabase
    .from("course_sections")
    .select("*, courses(school_id, academy_subject, delivery_mode)")
    .eq("id", input.sectionId)
    .single();

  if (!section) return { created: 0, skipped: 0, error: "Section not found" };
  if (!section.instructor_employee_id) {
    return { created: 0, skipped: 0, error: "Section has no primary instructor" };
  }

  const course = Array.isArray(section.courses) ? section.courses[0] : section.courses;
  const schoolId = (course as { school_id?: string })?.school_id;
  if (!schoolId) return { created: 0, skipped: 0, error: "School not found" };

  let instructorMeet = (section as { meet_link?: string | null }).meet_link ?? null;
  if (!instructorMeet) {
    const { data: profile } = await supabase
      .from("employee_profiles")
      .select("meet_link")
      .eq("employee_id", section.instructor_employee_id)
      .maybeSingle();
    instructorMeet = profile?.meet_link ?? null;
  }

  const { data: run } = await supabase
    .from("schedule_session_generation_runs")
    .insert({
      school_id: schoolId,
      course_section_id: input.sectionId,
      generated_by: input.generatedBy ?? null,
      date_from: input.dateFrom,
      date_to: input.dateTo,
      status: "running",
    })
    .select("id")
    .single();

  if (!run) return { created: 0, skipped: 0, error: "Failed to create generation run" };

  const blockedDates = await getBlockedDates(supabase, schoolId, input.dateFrom, input.dateTo);
  const meetingDays = parseMeetingDays(
    section.meeting_pattern as Record<string, unknown> | null,
    (section as { day_pattern?: string | null }).day_pattern ?? null,
    (section as { start_time_et?: string | null }).start_time_et ?? null
  );

  let created = 0;
  let skipped = 0;
  const from = new Date(input.dateFrom);
  const to = new Date(input.dateTo);

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    if (blockedDates.has(dateStr)) {
      skipped++;
      continue;
    }
    if (!meetingDays.days.includes(d.getDay())) continue;

    const start = buildSessionStart(d, meetingDays.startTime);
    const end =
      (course as { delivery_mode?: string })?.delivery_mode === "virtual" ||
      section.delivery_mode === "virtual"
        ? academyVirtualEndTime(start)
        : new Date(start.getTime() + ((section as { instructional_minutes?: number }).instructional_minutes ?? 50) * 60000);

    const { data: existing } = await supabase
      .from("instructional_sessions")
      .select("id")
      .eq("course_section_id", input.sectionId)
      .gte("scheduled_start", `${dateStr}T00:00:00`)
      .lt("scheduled_start", `${dateStr}T23:59:59`)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const timeDisplay = `${formatAcademyTime(start)} – ${formatAcademyTime(end)}`;

    const { error } = await supabase.from("instructional_sessions").insert({
      course_section_id: input.sectionId,
      instructor_employee_id: section.instructor_employee_id,
      campus_id: section.campus_id,
      room_id: section.room_id,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      session_status: "scheduled",
      session_type: mapSessionType(section.delivery_mode, (course as { academy_subject?: AcademySubject })?.academy_subject),
      meet_link: section.delivery_mode === "virtual" || section.delivery_mode === "hybrid" ? instructorMeet : null,
      generation_run_id: run.id,
      time_display: timeDisplay,
    });

    if (error) {
      skipped++;
    } else {
      created++;
    }
  }

  await supabase
    .from("schedule_session_generation_runs")
    .update({
      sessions_created: created,
      sessions_skipped: skipped,
      status: "completed",
    })
    .eq("id", run.id);

  await writeGenerationAudit(supabase, schoolId, input.sectionId, run.id, created);

  return { created, skipped, runId: run.id };
}

async function getBlockedDates(
  supabase: AuthClient,
  schoolId: string,
  from: string,
  to: string
): Promise<Set<string>> {
  const { data: calendars } = await supabase
    .from("academic_calendars")
    .select("id")
    .eq("school_id", schoolId)
    .eq("calendar_scope", "school")
    .eq("is_active", true);

  const ids = (calendars ?? []).map((c) => c.id);
  if (!ids.length) return new Set();

  const { data: events } = await supabase
    .from("academic_calendar_events")
    .select("starts_at, ends_at")
    .in("calendar_id", ids)
    .eq("blocks_scheduling", true)
    .lte("starts_at", `${to}T23:59:59`)
    .gte("ends_at", `${from}T00:00:00`);

  const blocked = new Set<string>();
  for (const ev of events ?? []) {
    const start = new Date(ev.starts_at);
    const end = new Date(ev.ends_at);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      blocked.add(d.toISOString().split("T")[0]);
    }
  }
  return blocked;
}

function parseMeetingDays(
  pattern: Record<string, unknown> | null,
  dayPattern: string | null,
  startTimeEt: string | null
): { days: number[]; startTime: string } {
  const days: number[] = [];
  if (pattern && Array.isArray(pattern.days)) {
    for (const d of pattern.days) {
      if (typeof d === "number") days.push(d);
      else if (typeof d === "string") days.push(DAY_MAP[d.toLowerCase()] ?? 1);
    }
  }
  if (!days.length && dayPattern) {
    dayPattern.split(/[,/\s]+/).forEach((p) => {
      const n = DAY_MAP[p.trim().toLowerCase()];
      if (n !== undefined) days.push(n);
    });
  }
  if (!days.length) days.push(1, 2, 3, 4, 5);
  return { days, startTime: startTimeEt ?? "09:00:00" };
}

function buildSessionStart(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const start = new Date(date);
  start.setHours(h ?? 9, m ?? 0, 0, 0);
  return start;
}

function mapSessionType(deliveryMode?: string | null, subject?: AcademySubject | null): string {
  if (deliveryMode === "tutoring") return "tutoring";
  if (deliveryMode === "therapy") return "therapy";
  if (subject === "structured_literacy") return "instruction";
  return "instruction";
}

async function writeGenerationAudit(
  supabase: AuthClient,
  schoolId: string,
  sectionId: string,
  runId: string,
  created: number
) {
  const { writePlatformAudit } = await import("@/lib/platform/automation/audit");
  await writePlatformAudit(supabase, {
    schoolId,
    module: "scheduling",
    entityType: "course_section",
    entityId: sectionId,
    actionType: "session_generation",
    summary: `Generated ${created} instructional sessions`,
    metadata: { runId },
  });
}
