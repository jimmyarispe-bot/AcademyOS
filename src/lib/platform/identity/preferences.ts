import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { UserPreferences } from "@/lib/platform/identity/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getUserPreferences(supabase: AuthClient, userId: string) {
  const { data } = await supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
  return data as UserPreferences | null;
}

export async function upsertUserPreferences(
  supabase: AuthClient,
  userId: string,
  patch: Partial<Omit<UserPreferences, "user_id">>
) {
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() })
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { data: data as UserPreferences };
}

export const DEFAULT_PREFERENCES: Omit<UserPreferences, "user_id"> = {
  timezone: "America/New_York",
  language: "en",
  theme: "system",
  dashboard_layout: {},
  notifications: { email: true, sms: false, dashboard: true },
  accessibility: { reducedMotion: false, highContrast: false },
  communication: { digest: "daily" },
  mission_control_widgets: { failedAutomations: true, pendingTasks: true, queueStatus: true },
};
