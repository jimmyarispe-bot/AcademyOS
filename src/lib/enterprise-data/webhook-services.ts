import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function listWebhooks(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("edp_webhooks")
    .select("*")
    .eq("organization_id", organizationId)
    .order("webhook_name");
  return data ?? [];
}

export async function createWebhook(
  supabase: AuthClient,
  input: {
    organizationId: string;
    webhookName: string;
    direction: "incoming" | "outgoing";
    endpointUrl?: string;
    eventTypes?: string[];
    retryPolicy?: { max_retries: number; backoff_ms: number };
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("edp_webhooks")
    .insert({
      organization_id: input.organizationId,
      webhook_name: input.webhookName,
      direction: input.direction,
      endpoint_url: input.endpointUrl ?? null,
      event_types: input.eventTypes ?? [],
      retry_policy: input.retryPolicy ?? { max_retries: 3, backoff_ms: 1000 },
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { webhookId: data.id };
}

export async function getWebhookDeliveries(supabase: AuthClient, webhookId: string, limit = 20) {
  const { data } = await supabase
    .from("edp_webhook_deliveries")
    .select("*")
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function testWebhook(supabase: AuthClient, webhookId: string) {
  const { data: webhook } = await supabase.from("edp_webhooks").select("*").eq("id", webhookId).single();
  if (!webhook) return { error: "Webhook not found" };

  await supabase.from("edp_webhook_deliveries").insert({
    webhook_id: webhookId,
    event_type: "test.ping",
    payload: { test: true, timestamp: new Date().toISOString() },
    status: webhook.direction === "outgoing" ? "pending" : "delivered",
    attempt_count: 1,
    delivered_at: webhook.direction === "incoming" ? new Date().toISOString() : null,
  });

  return { success: true };
}
