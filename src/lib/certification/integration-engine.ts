import type { createAuthClient } from "@/lib/supabase/server-auth";
import { INTEGRATION_CHECKS } from "@/lib/certification/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function runIntegrationCertification(supabase: AuthClient, certRunId: string) {
  const { data: connectors } = await supabase.from("edp_connector_definitions").select("connector_key").limit(20);
  const connectorKeys = new Set((connectors ?? []).map((c) => c.connector_key));
  let healthy = 0;

  for (const integration of INTEGRATION_CHECKS) {
    let status: "healthy" | "warning" | "failure" = "healthy";

    if (integration.key === "quickbooks" && !connectorKeys.has("quickbooks_online")) status = "warning";
    if (integration.key === "enterprise_data") {
      const { count } = await supabase.from("edp_import_batches").select("id", { count: "exact", head: true });
      if (!count) status = "warning";
    }
    if (integration.key === "webhooks") {
      const { count } = await supabase.from("edp_webhook_endpoints").select("id", { count: "exact", head: true });
      if (!count) status = "warning";
    }

    if (status === "healthy") healthy++;

    await supabase.from("cert_integration_health").insert({
      cert_run_id: certRunId,
      integration_key: integration.key,
      integration_name: integration.name,
      status,
      details: { connectorRegistered: connectorKeys.has(integration.key) },
    });
  }

  return { integrationScore: (healthy / INTEGRATION_CHECKS.length) * 100 };
}

export async function getLatestIntegrationHealth(supabase: AuthClient) {
  const { data: run } = await supabase.from("cert_runs").select("id").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) return [];
  const { data } = await supabase.from("cert_integration_health").select("*").eq("cert_run_id", run.id);
  return data ?? [];
}
