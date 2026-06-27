import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface StudentReadinessSnapshot {
  medicalAlerts: string[];
  iepAccommodations: string[];
  instructionalLevels: Record<string, string | null>;
  activeInterventions: { type: string; goal?: string | null }[];
  recentAttendance: { date: string; status: string }[];
  recentBehavior: { title: string; occurredAt: string }[];
  openCommunications: { subject: string; sentAt?: string | null }[];
  outstandingTasks: { title: string; dueDate?: string | null }[];
}

export async function getStudentReadinessSnapshot(
  supabase: AuthClient,
  studentId: string
): Promise<StudentReadinessSnapshot> {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [medical, sped, profile, interventions, attendance, behavior, outreach, meetingTasks] =
    await Promise.all([
      supabase.from("student_medical_profiles").select("health_alerts, allergies").eq("student_id", studentId).maybeSingle(),
      supabase
        .from("student_special_education_plans")
        .select("accommodations, plan_type")
        .eq("student_id", studentId)
        .eq("status", "active"),
      supabase.from("student_learning_profiles").select("reading_level, writing_level, math_level, structured_literacy_level").eq("student_id", studentId).maybeSingle(),
      supabase
        .from("student_academic_interventions")
        .select("intervention_type, goal_text")
        .eq("student_id", studentId)
        .eq("status", "active"),
      supabase
        .from("student_attendance_records")
        .select("attendance_date, status")
        .eq("student_id", studentId)
        .order("attendance_date", { ascending: false })
        .limit(5),
      supabase
        .from("student_behavior_events")
        .select("title, occurred_at")
        .eq("student_id", studentId)
        .gte("occurred_at", weekAgo)
        .order("occurred_at", { ascending: false })
        .limit(5),
      supabase
        .from("teacher_parent_outreach")
        .select("subject, sent_at, status")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("student_instructional_meeting_tasks")
        .select("title, due_date, status, student_instructional_meetings!inner(student_id)")
        .eq("student_instructional_meetings.student_id", studentId)
        .eq("status", "open")
        .limit(5),
    ]);

  const medicalAlerts: string[] = [];
  if (medical.data?.health_alerts && Array.isArray(medical.data.health_alerts)) {
    for (const a of medical.data.health_alerts) {
      if (typeof a === "string") medicalAlerts.push(a);
      else if (a && typeof a === "object" && "message" in a) medicalAlerts.push(String((a as { message: string }).message));
    }
  }
  if (medical.data?.allergies && Array.isArray(medical.data.allergies) && medical.data.allergies.length) {
    medicalAlerts.push("Allergies on file");
  }

  const accommodations: string[] = [];
  for (const plan of sped.data ?? []) {
    const acc = plan.accommodations;
    if (Array.isArray(acc)) {
      for (const a of acc) {
        accommodations.push(typeof a === "string" ? a : JSON.stringify(a));
      }
    }
  }

  return {
    medicalAlerts,
    iepAccommodations: accommodations.slice(0, 8),
    instructionalLevels: {
      reading: profile.data?.reading_level ?? null,
      writing: profile.data?.writing_level ?? null,
      math: profile.data?.math_level ?? null,
      structuredLiteracy: profile.data?.structured_literacy_level ?? null,
    },
    activeInterventions: (interventions.data ?? []).map((i) => ({
      type: i.intervention_type,
      goal: i.goal_text,
    })),
    recentAttendance: (attendance.data ?? []).map((a) => ({
      date: a.attendance_date,
      status: a.status,
    })),
    recentBehavior: (behavior.data ?? []).map((b) => ({
      title: b.title,
      occurredAt: b.occurred_at,
    })),
    openCommunications: (outreach.data ?? [])
      .filter((o) => o.status === "draft" || o.status === "sent")
      .map((o) => ({ subject: o.subject, sentAt: o.sent_at })),
    outstandingTasks: (meetingTasks.data ?? []).map((t) => ({
      title: t.title,
      dueDate: t.due_date,
    })),
  };
}

export async function getSessionReadinessForStudents(
  supabase: AuthClient,
  studentIds: string[]
): Promise<Map<string, StudentReadinessSnapshot>> {
  const map = new Map<string, StudentReadinessSnapshot>();
  for (const id of studentIds) {
    map.set(id, await getStudentReadinessSnapshot(supabase, id));
  }
  return map;
}
