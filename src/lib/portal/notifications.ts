import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getPortalNotifications(supabase: AuthClient, userId: string, limit = 50) {
  const { data } = await supabase
    .from("portal_family_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function getUnreadNotificationCount(supabase: AuthClient, userId: string) {
  const { count } = await supabase
    .from("portal_family_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  return count ?? 0;
}

export async function createPortalNotification(
  supabase: AuthClient,
  input: {
    userId: string;
    familyId?: string | null;
    studentId?: string | null;
    category: string;
    title: string;
    body: string;
    href?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("portal_family_notifications").insert({
    user_id: input.userId,
    family_id: input.familyId ?? null,
    student_id: input.studentId ?? null,
    category: input.category,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    metadata: input.metadata ?? {},
  });
}
