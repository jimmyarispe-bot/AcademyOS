import type { createAuthClient } from "@/lib/supabase/server-auth";
import { logStudentCommunicationEvent } from "@/lib/ssis/timeline";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function recordSessionAttendance(
  supabase: AuthClient,
  input: {
    sessionId: string;
    studentId: string;
    status: string;
    notifyParent?: boolean;
    notes?: string;
    recordedBy?: string | null;
  }
) {
  const { data: session } = await supabase
    .from("instructional_sessions")
    .select("id, scheduled_start, course_section_id, course_sections(courses(school_id))")
    .eq("id", input.sessionId)
    .single();

  if (!session) return { error: "Session not found" };

  const dateStr = new Date(session.scheduled_start).toISOString().split("T")[0];
  const cs = Array.isArray(session.course_sections) ? session.course_sections[0] : session.course_sections;
  const course = cs?.courses;
  const schoolId = (Array.isArray(course) ? course[0] : course)?.school_id as string | undefined;

  const { data: sisRecord, error: sisError } = await supabase
    .from("student_attendance_records")
    .upsert(
      {
        student_id: input.studentId,
        attendance_date: dateStr,
        status: input.status,
        attendance_context: "period",
        notes: input.notes ?? null,
        parent_notified: input.notifyParent ?? false,
        parent_notified_at: input.notifyParent ? new Date().toISOString() : null,
        recorded_by: input.recordedBy ?? null,
      },
      { onConflict: "student_id,attendance_date" }
    )
    .select("id")
    .single();

  if (sisError) return { error: sisError.message };

  await supabase.from("session_attendance_records").upsert(
    {
      instructional_session_id: input.sessionId,
      student_id: input.studentId,
      attendance_status: input.status,
      sis_attendance_record_id: sisRecord?.id ?? null,
      recorded_by: input.recordedBy ?? null,
      notes: input.notes ?? null,
    },
    { onConflict: "instructional_session_id,student_id" }
  );

  await logStudentCommunicationEvent(supabase, {
    studentId: input.studentId,
    schoolId,
    channel: "attendance",
    direction: "internal",
    subject: `Session attendance: ${input.status.replace(/_/g, " ")}`,
    body: input.notes ?? `Recorded from instructional session`,
    actorUserId: input.recordedBy,
    relatedEntityType: "instructional_sessions",
    relatedEntityId: input.sessionId,
  });

  if (input.notifyParent && input.status.startsWith("absent")) {
    const { processAttendanceParentNotifications } = await import("@/lib/ssis/attendance-notifications");
    await processAttendanceParentNotifications(supabase);
  }

  return { success: true, sisRecordId: sisRecord?.id };
}
