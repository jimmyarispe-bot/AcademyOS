import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getPortalConversations(supabase: AuthClient, userId: string, studentId?: string) {
  let q = supabase
    .from("portal_conversations")
    .select("*, students(first_name, last_name)")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (studentId) q = q.eq("student_id", studentId);

  const { data } = await q;
  return data ?? [];
}

export async function getPortalMessages(supabase: AuthClient, conversationId: string) {
  const { data } = await supabase
    .from("portal_messages")
    .select("*, portal_message_reads(user_id, read_at)")
    .eq("conversation_id", conversationId)
    .order("created_at");

  return data ?? [];
}

export async function searchPortalMessages(supabase: AuthClient, userId: string, query: string) {
  const { data: conversations } = await supabase
    .from("portal_conversations")
    .select("id")
    .limit(100);

  const ids = conversations?.map((c) => c.id) ?? [];
  if (!ids.length) return [];

  const { data } = await supabase
    .from("portal_messages")
    .select("*, portal_conversations(subject, student_id, category)")
    .in("conversation_id", ids)
    .ilike("body", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(30);

  return data ?? [];
}
