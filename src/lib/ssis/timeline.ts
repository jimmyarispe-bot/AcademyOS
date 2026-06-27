import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface LogCommunicationInput {
  studentId: string;
  schoolId?: string | null;
  channel: string;
  direction?: "inbound" | "outbound" | "internal";
  subject: string;
  body?: string;
  actorUserId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export async function logStudentCommunicationEvent(
  supabase: AuthClient,
  input: LogCommunicationInput
) {
  await supabase.from("ssis_communication_events").insert({
    student_id: input.studentId,
    school_id: input.schoolId ?? null,
    channel: input.channel,
    direction: input.direction ?? "outbound",
    subject: input.subject,
    body: input.body ?? "",
    actor_user_id: input.actorUserId ?? null,
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
    metadata: input.metadata ?? {},
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  });
}

export async function getStudentCommunicationTimeline(
  supabase: AuthClient,
  studentId: string,
  options?: { query?: string; limit?: number }
) {
  let q = supabase
    .from("ssis_communication_events")
    .select("*")
    .eq("student_id", studentId)
    .order("occurred_at", { ascending: false })
    .limit(options?.limit ?? 100);

  const { data } = await q;
  let events = data ?? [];

  if (options?.query) {
    const needle = options.query.toLowerCase();
    events = events.filter(
      (e) =>
        e.subject.toLowerCase().includes(needle) ||
        (e.body as string).toLowerCase().includes(needle)
    );
  }

  return events;
}

export async function aggregateStudentTimeline(
  supabase: AuthClient,
  studentId: string,
  admissionsLeadId?: string | null
) {
  const [communications, platformTimeline, missionControl] = await Promise.all([
    getStudentCommunicationTimeline(supabase, studentId, { limit: 50 }),
    supabase
      .from("platform_timeline_events")
      .select("*")
      .eq("entity_type", "student")
      .eq("entity_id", studentId)
      .order("occurred_at", { ascending: false })
      .limit(30),
    supabase
      .from("platform_mission_control_items")
      .select("id, title, body, severity, created_at, is_resolved")
      .eq("entity_type", "student")
      .eq("entity_id", studentId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const admissionsComms = admissionsLeadId
    ? await supabase
        .from("admissions_communications")
        .select("id, communication_type, subject, body, sent_at, delivery_status")
        .eq("lead_id", admissionsLeadId)
        .order("sent_at", { ascending: false })
        .limit(20)
    : { data: [] };

  return {
    communications,
    platformEvents: platformTimeline.data ?? [],
    missionControlAlerts: missionControl.data ?? [],
    admissionsCommunications: admissionsComms.data ?? [],
  };
}
