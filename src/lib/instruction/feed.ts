import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface PublishFeedEventInput {
  studentId: string;
  schoolId?: string | null;
  actorEmployeeId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  title: string;
  body?: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  classification?: "public" | "internal" | "confidential" | "restricted";
  metadata?: Record<string, unknown>;
}

export async function publishCollaborationFeedEvent(
  supabase: AuthClient,
  input: PublishFeedEventInput
) {
  let schoolId = input.schoolId;
  if (!schoolId) {
    const { data: student } = await supabase
      .from("students")
      .select("school_id")
      .eq("id", input.studentId)
      .single();
    schoolId = student?.school_id;
  }

  await supabase.from("student_collaboration_feed_events").insert({
    student_id: input.studentId,
    school_id: schoolId,
    actor_employee_id: input.actorEmployeeId ?? null,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    title: input.title,
    body: input.body ?? "",
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
    classification: input.classification ?? "internal",
    metadata: input.metadata ?? {},
  });
}

export async function getStudentCollaborationFeed(
  supabase: AuthClient,
  studentId: string,
  limit = 30
) {
  const { data } = await supabase
    .from("student_collaboration_feed_events")
    .select("*, employees:actor_employee_id(id, employee_profiles(display_name))")
    .eq("student_id", studentId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getCollaborationFeedForTeacher(
  supabase: AuthClient,
  employeeId: string,
  limit = 40
) {
  const { data: memberships } = await supabase
    .from("student_instructional_team_members")
    .select("team_id, student_instructional_teams(student_id)")
    .eq("employee_id", employeeId)
    .eq("is_active", true);

  const studentIds = [
    ...new Set(
      (memberships ?? [])
        .map((m) => {
          const t = Array.isArray(m.student_instructional_teams)
            ? m.student_instructional_teams[0]
            : m.student_instructional_teams;
          return (t as { student_id?: string })?.student_id;
        })
        .filter(Boolean)
    ),
  ] as string[];

  if (!studentIds.length) return [];

  const { data } = await supabase
    .from("student_collaboration_feed_events")
    .select("*, students(first_name, last_name)")
    .in("student_id", studentIds)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
