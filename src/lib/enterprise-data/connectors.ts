import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getConnectorDefinitions(supabase: AuthClient) {
  const { data } = await supabase
    .from("edp_connector_definitions")
    .select("*")
    .order("sort_order");
  return data ?? [];
}

export async function getConnectorInstances(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("edp_connector_instances")
    .select("*, edp_connector_definitions(display_name, category, supports_sync)")
    .eq("organization_id", organizationId)
    .order("instance_name");
  return data ?? [];
}

export async function createConnectorInstance(
  supabase: AuthClient,
  input: {
    organizationId: string;
    connectorKey: string;
    instanceName: string;
    syncDirection?: string;
    config?: Record<string, unknown>;
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("edp_connector_instances")
    .insert({
      organization_id: input.organizationId,
      connector_key: input.connectorKey,
      instance_name: input.instanceName,
      sync_direction: input.syncDirection ?? "import",
      config: input.config ?? {},
      status: "pending_auth",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { instanceId: data.id };
}

export async function updateConnectorHealth(
  supabase: AuthClient,
  instanceId: string,
  healthStatus: "healthy" | "degraded" | "unhealthy" | "unknown"
) {
  await supabase.from("edp_connector_instances").update({ health_status: healthStatus }).eq("id", instanceId);
}

export async function getConnectorHealthReport(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("rpt_edp_connector_health")
    .select("*")
    .eq("organization_id", organizationId);
  return data ?? [];
}
