import type { createAuthClient } from "@/lib/supabase/server-auth";
import { WEBHOOK_EVENT_TYPES } from "@/lib/integration-hub/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function publishEvent(
  supabase: AuthClient,
  input: {
    organizationId: string | null;
    eventType: string;
    eventSource: string;
    payload?: Record<string, unknown>;
    correlationId?: string;
  }
) {
  const { data, error } = await supabase
    .from("ihub_events")
    .insert({
      organization_id: input.organizationId,
      event_type: input.eventType,
      event_source: input.eventSource,
      event_version: "1.0",
      payload: input.payload ?? {},
      correlation_id: input.correlationId ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { data: subs } = await supabase
    .from("ihub_event_subscriptions")
    .select("*")
    .eq("is_active", true)
    .contains("event_types", [input.eventType]);

  return { eventId: data.id, subscriptionsNotified: subs?.length ?? 0 };
}

export async function getRecentEvents(supabase: AuthClient, organizationId?: string | null, limit = 50) {
  let query = supabase.from("ihub_events").select("*").order("published_at", { ascending: false }).limit(limit);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data } = await query;
  return data ?? [];
}

export async function replayEvent(supabase: AuthClient, eventId: string) {
  const { data: event } = await supabase.from("ihub_events").select("*").eq("id", eventId).single();
  if (!event || !event.replayable) return { error: "Event not replayable" };

  return publishEvent(supabase, {
    organizationId: event.organization_id,
    eventType: event.event_type,
    eventSource: "replay",
    payload: event.payload as Record<string, unknown>,
    correlationId: event.id,
  });
}

export async function getEventSubscriptions(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_event_subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("subscription_name");
  return data ?? [];
}

export function getEventCatalog() {
  return WEBHOOK_EVENT_TYPES;
}

export async function seedDefaultSubscriptions(supabase: AuthClient, organizationId: string) {
  const { count } = await supabase
    .from("ihub_event_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (count) return;

  await supabase.from("ihub_event_subscriptions").insert({
    organization_id: organizationId,
    subscription_name: "Platform Webhooks",
    event_types: WEBHOOK_EVENT_TYPES.map((e) => e.key),
    target_type: "webhook",
    is_active: true,
  });
}
