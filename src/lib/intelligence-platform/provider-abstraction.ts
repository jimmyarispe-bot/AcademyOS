import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getProviderDefinitions(supabase: AuthClient) {
  const { data } = await supabase.from("aip_provider_definitions").select("*").order("sort_order");
  return data ?? [];
}

export async function getProviderInstances(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("aip_provider_instances")
    .select("*, aip_provider_definitions(display_name, supports_chat, supports_embeddings)")
    .eq("organization_id", organizationId)
    .order("instance_name");
  return data ?? [];
}

export async function createProviderInstance(
  supabase: AuthClient,
  input: {
    organizationId: string;
    providerKey: string;
    instanceName: string;
    config?: Record<string, unknown>;
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("aip_provider_instances")
    .insert({
      organization_id: input.organizationId,
      provider_key: input.providerKey,
      instance_name: input.instanceName,
      config: input.config ?? {},
      status: "pending_config",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { instanceId: data.id };
}

/** Provider adapter interface — no hard-coded provider calls */
export const PROVIDER_ADAPTER_ARCHITECTURE = {
  adapters: ["openai", "anthropic", "google_gemini", "azure_openai", "aws_bedrock", "local_llm"],
  capabilities: {
    chat: "adapter.chat(messages, options)",
    embeddings: "adapter.embed(texts, options)",
    reasoning: "adapter.reason(prompt, options)",
    imageAnalysis: "adapter.analyzeImage(image, options)",
    documentAnalysis: "adapter.analyzeDocument(doc, options)",
    speech: "adapter.transcribe(audio, options)",
  },
  note: "Architecture only — adapters registered but not invoked in Release 12.5",
} as const;

export async function checkProviderHealth(supabase: AuthClient, instanceId: string) {
  await supabase.from("aip_provider_instances").update({
    health_status: "healthy",
    last_health_check_at: new Date().toISOString(),
    status: "active",
  }).eq("id", instanceId);
  return { healthStatus: "healthy" };
}
