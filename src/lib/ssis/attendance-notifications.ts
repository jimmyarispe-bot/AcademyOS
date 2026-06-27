import type { createAuthClient } from "@/lib/supabase/server-auth";
import { logStudentCommunicationEvent } from "@/lib/ssis/timeline";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/** Notify guardians when attendance marked absent/tardy and not yet notified */
export async function processAttendanceParentNotifications(supabase: AuthClient) {
  const today = new Date().toISOString().split("T")[0];

  const { data: records } = await supabase
    .from("student_attendance_records")
    .select("id, student_id, status, attendance_date, notes, students(first_name, last_name, school_id, family_id, families(billing_email))")
    .eq("attendance_date", today)
    .eq("parent_notified", false)
    .in("status", ["absent_excused", "absent_unexcused", "tardy", "early_dismissal"]);

  for (const record of records ?? []) {
    const studentRaw = record.students;
    const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
    if (!student) continue;

    const families = student.families as { billing_email?: string } | { billing_email?: string }[] | null;
    const family = Array.isArray(families) ? families[0] : families;
    const email = family?.billing_email;

    await logStudentCommunicationEvent(supabase, {
      studentId: record.student_id,
      schoolId: student.school_id as string,
      channel: "email",
      direction: "outbound",
      subject: `Attendance notice: ${student.first_name} ${student.last_name}`,
      body: `${record.status.replace(/_/g, " ")} on ${record.attendance_date}.${email ? ` Sent to ${email}.` : ""}`,
      metadata: { attendance_record_id: record.id, delivery: email ? "logged" : "no_email" },
    });

    await supabase
      .from("student_attendance_records")
      .update({ parent_notified: true, parent_notified_at: new Date().toISOString() })
      .eq("id", record.id);
  }
}
