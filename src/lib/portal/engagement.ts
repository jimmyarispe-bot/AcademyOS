import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getParentEngagementSummary } from "@/lib/ssis/engagement";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getFamilyEngagementDashboard(supabase: AuthClient, studentIds: string[]) {
  const summaries = [];
  for (const studentId of studentIds) {
    const { data: student } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("id", studentId)
      .single();
    if (!student) continue;

    const engagement = await getParentEngagementSummary(supabase, studentId);

    const { count: conferenceCount } = await supabase
      .from("student_instructional_meetings")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "completed")
      .gte("scheduled_at", new Date(Date.now() - 365 * 86400000).toISOString());

    const { count: formsCompleted } = await supabase
      .from("portal_form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "submitted")
      .gte("submitted_at", `${new Date().getFullYear()}-01-01`);

    summaries.push({
      student,
      engagementScore: engagement.engagementScore,
      portalLogins: engagement.portalLogins,
      messages: engagement.messages,
      documentUploads: engagement.documentUploads,
      conferencesAttended: conferenceCount ?? 0,
      formsCompleted: formsCompleted ?? 0,
      suggestions: buildEngagementSuggestions(engagement, conferenceCount ?? 0, formsCompleted ?? 0),
    });
  }

  const overallScore = summaries.length
    ? Math.round(summaries.reduce((s, x) => s + x.engagementScore, 0) / summaries.length)
    : 0;

  return { summaries, overallScore };
}

function buildEngagementSuggestions(
  engagement: Awaited<ReturnType<typeof getParentEngagementSummary>>,
  conferences: number,
  forms: number
): string[] {
  const tips: string[] = [];
  if (engagement.portalLogins === 0) tips.push("Log in weekly to stay current on your child's progress.");
  if (engagement.messages === 0) tips.push("Send a message to your child's teacher through Secure Messaging.");
  if (conferences === 0) tips.push("Schedule a parent conference to connect with the instructional team.");
  if (forms === 0) tips.push("Complete pending forms in the Family Forms Center.");
  if (engagement.documentUploads === 0) tips.push("Upload updated medical or funding documents when available.");
  if (!tips.length) tips.push("Great engagement — keep checking the portal for updates and announcements.");
  return tips;
}
