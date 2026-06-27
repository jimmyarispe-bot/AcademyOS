import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getEventDeadLetter(supabase: AuthClient, organizationId: string, limit = 30) {
  const { data } = await supabase
    .from("ihub_event_dead_letter")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getRetentionPolicies(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_event_retention_policies")
    .select("*")
    .eq("organization_id", organizationId);
  return data ?? [];
}

export async function searchEvents(
  supabase: AuthClient,
  organizationId: string,
  query: { eventType?: string; limit?: number }
) {
  let q = supabase
    .from("ihub_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("published_at", { ascending: false })
    .limit(query.limit ?? 50);
  if (query.eventType) q = q.eq("event_type", query.eventType);
  const { data } = await q;
  return data ?? [];
}

export async function seedDefaultRetentionPolicy(supabase: AuthClient, organizationId: string) {
  const { count } = await supabase
    .from("ihub_event_retention_policies")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (count) return;

  await supabase.from("ihub_event_retention_policies").insert({
    organization_id: organizationId,
    retention_days: 90,
    is_active: true,
  });
}
