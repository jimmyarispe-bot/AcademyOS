import type { createAuthClient } from "@/lib/supabase/server-auth";
import { WEBHOOK_EVENT_TYPES } from "@/lib/integration-hub/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getWebhooks(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("edp_webhooks")
    .select("*")
    .eq("organization_id", organizationId)
    .order("webhook_name");
  return data ?? [];
}

export async function getWebhookDeliveries(supabase: AuthClient, organizationId: string, limit = 30) {
  const { data: hooks } = await supabase.from("edp_webhooks").select("id").eq("organization_id", organizationId);
  const ids = (hooks ?? []).map((h) => h.id);
  if (!ids.length) return [];

  const { data } = await supabase
    .from("edp_webhook_deliveries")
    .select("*")
    .in("webhook_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function createOutgoingWebhook(
  supabase: AuthClient,
  input: {
    organizationId: string;
    webhookName: string;
    endpointUrl: string;
    eventTypes?: string[];
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("edp_webhooks")
    .insert({
      organization_id: input.organizationId,
      webhook_name: input.webhookName,
      direction: "outgoing",
      endpoint_url: input.endpointUrl,
      event_types: input.eventTypes ?? WEBHOOK_EVENT_TYPES.map((e) => e.key),
      signing_enabled: true,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { webhookId: data.id };
}

export async function getDeadLetterQueue(supabase: AuthClient, organizationId: string, limit = 20) {
  const { data } = await supabase
    .from("ihub_webhook_dead_letter")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function recordWebhookFailure(
  supabase: AuthClient,
  input: { organizationId: string; webhookId?: string; eventType: string; payload?: Record<string, unknown>; reason?: string }
) {
  await supabase.from("ihub_webhook_dead_letter").insert({
    organization_id: input.organizationId,
    webhook_id: input.webhookId ?? null,
    event_type: input.eventType,
    payload: input.payload ?? {},
    failure_reason: input.reason ?? "delivery_failed",
    attempt_count: 3,
  });
}

export function getSupportedWebhookEvents() {
  return WEBHOOK_EVENT_TYPES;
}
