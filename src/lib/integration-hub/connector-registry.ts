import type { createAuthClient } from "@/lib/supabase/server-auth";
import { HEALTHCARE_CONNECTORS, STATE_FUNDING_CONNECTORS } from "@/lib/integration-hub/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getConnectorLibrary(supabase: AuthClient, category?: string) {
  let query = supabase.from("edp_connector_definitions").select("*").order("sort_order");
  if (category) query = query.eq("category", category);
  const { data } = await query;
  return data ?? [];
}

export async function getHealthcareConnectors(supabase: AuthClient) {
  const { data } = await supabase
    .from("edp_connector_definitions")
    .select("*")
    .in("connector_key", [...HEALTHCARE_CONNECTORS])
    .order("sort_order");
  return data ?? [];
}

export async function getStateFundingConnectors(supabase: AuthClient) {
  const { data } = await supabase
    .from("edp_connector_definitions")
    .select("*")
    .in("connector_key", [...STATE_FUNDING_CONNECTORS])
    .order("sort_order");
  return data ?? [];
}

export async function getInstalledConnectors(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("edp_connector_instances")
    .select("*, edp_connector_definitions(display_name, category, supports_sync)")
    .eq("organization_id", organizationId)
    .order("instance_name");
  return data ?? [];
}

export async function installConnector(
  supabase: AuthClient,
  input: { organizationId: string; connectorKey: string; instanceName: string; createdBy?: string }
) {
  const { data, error } = await supabase
    .from("edp_connector_instances")
    .insert({
      organization_id: input.organizationId,
      connector_key: input.connectorKey,
      instance_name: input.instanceName,
      status: "pending_auth",
      sync_direction: "bidirectional",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { instanceId: data.id };
}
