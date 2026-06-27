import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getParentEngagementSummary(supabase: AuthClient, studentId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: events } = await supabase
    .from("ssis_parent_engagement_events")
    .select("*")
    .eq("student_id", studentId)
    .gte("occurred_at", thirtyDaysAgo)
    .order("occurred_at", { ascending: false });

  const list = events ?? [];
  const score = list.reduce((s, e) => s + (e.engagement_score ?? 0), 0);
  const logins = list.filter((e) => e.event_type === "portal_login").length;
  const messages = list.filter((e) => e.event_type.startsWith("message")).length;
  const uploads = list.filter((e) => e.event_type === "document_upload").length;

  const disengaged = logins === 0 && messages === 0 && score < 2;

  return {
    events: list,
    engagementScore: score,
    portalLogins: logins,
    messages,
    documentUploads: uploads,
    disengaged,
  };
}

export async function recordParentEngagementEvent(
  supabase: AuthClient,
  input: {
    studentId: string;
    familyId?: string | null;
    guardianId?: string | null;
    eventType: string;
    summary: string;
    engagementScore?: number;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("ssis_parent_engagement_events").insert({
    student_id: input.studentId,
    family_id: input.familyId ?? null,
    guardian_id: input.guardianId ?? null,
    event_type: input.eventType,
    summary: input.summary,
    engagement_score: input.engagementScore ?? 1,
    metadata: input.metadata ?? {},
  });
}

export async function processDisengagedFamilies(supabase: AuthClient) {
  const { data: students } = await supabase
    .from("students")
    .select("id, school_id, first_name, last_name, family_id")
    .eq("lifecycle_stage", "active")
    .limit(100);

  for (const student of students ?? []) {
    const summary = await getParentEngagementSummary(supabase, student.id);
    if (!summary.disengaged) continue;

    await createMissionControlItem(supabase, {
      schoolId: student.school_id,
      module: "sis",
      itemType: "admissions_alert",
      title: `Low parent engagement: ${student.first_name} ${student.last_name}`,
      body: "No portal activity or messages in the last 30 days.",
      entityType: "student",
      entityId: student.id,
      href: `/dashboard/students/${student.id}?tab=engagement`,
      assignedRole: "SCHOOL_LEADER",
      severity: "normal",
    });
  }
}
