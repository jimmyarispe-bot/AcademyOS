import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getParentConferenceCenter(supabase: AuthClient, studentIds: string[]) {
  if (!studentIds.length) return { meetings: [], requests: [] };

  const [meetings, requests] = await Promise.all([
    supabase
      .from("student_instructional_meetings")
      .select("*, students(first_name, last_name)")
      .in("student_id", studentIds)
      .eq("parent_visible", true)
      .order("scheduled_at", { ascending: false })
      .limit(30),
    supabase
      .from("portal_conference_requests")
      .select("*, students(first_name, last_name)")
      .in("student_id", studentIds)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    meetings: meetings.data ?? [],
    requests: requests.data ?? [],
  };
}
