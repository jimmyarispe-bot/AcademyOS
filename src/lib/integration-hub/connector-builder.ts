import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { CustomConnectorProtocol } from "@/lib/integration-hub/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getCustomConnectors(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_custom_connectors")
    .select("*")
    .eq("organization_id", organizationId)
    .order("connector_name");
  return data ?? [];
}

export async function createCustomConnector(
  supabase: AuthClient,
  input: {
    organizationId: string;
    connectorName: string;
    protocol: CustomConnectorProtocol;
    config?: Record<string, unknown>;
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("ihub_custom_connectors")
    .insert({
      organization_id: input.organizationId,
      connector_name: input.connectorName,
      protocol: input.protocol,
      config: input.config ?? {},
      status: "draft",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { connectorId: data.id };
}

export async function activateCustomConnector(supabase: AuthClient, connectorId: string) {
  await supabase.from("ihub_custom_connectors").update({ status: "active" }).eq("id", connectorId);
}
