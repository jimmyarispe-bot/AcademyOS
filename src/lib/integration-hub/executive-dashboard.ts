import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ExecutiveIntegrationSnapshot } from "@/lib/integration-hub/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function captureExecutiveSnapshot(supabase: AuthClient, organizationId: string): Promise<ExecutiveIntegrationSnapshot> {
  const since = new Date(Date.now() - 86400000).toISOString();
  const [installed, syncFailed, events, apiCalls, webhooks, deliveries] = await Promise.all([
    supabase.from("edp_connector_instances").select("id, status, health_status").eq("organization_id", organizationId),
    supabase.from("edp_sync_jobs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "failed"),
    supabase.from("ihub_events").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("published_at", since),
    supabase.from("ihub_api_audit_log").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("created_at", since),
    supabase.from("edp_webhooks").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("edp_webhook_deliveries").select("status").limit(100),
  ]);

  const inst = installed.data ?? [];
  const healthy = inst.filter((i) => i.health_status === "healthy").length;
  const connectorHealthPct = inst.length ? (healthy / inst.length) * 100 : 100;
  const delivered = (deliveries.data ?? []).filter((d) => d.status === "delivered").length;
  const totalDeliveries = deliveries.data?.length ?? 1;
  const webhookSuccessRate = totalDeliveries ? (delivered / totalDeliveries) * 100 : 100;

  const snapshot: ExecutiveIntegrationSnapshot = {
    connectedSystems: inst.filter((i) => i.status === "active").length,
    connectorHealthPct,
    failedSyncs: syncFailed.count ?? 0,
    dailyTransactions: events.count ?? 0,
    webhookSuccessRate,
    apiUsageCount: apiCalls.count ?? 0,
    externalDataVolumeMb: (events.count ?? 0) * 0.5,
    marketplaceRevenue: 0,
  };

  await supabase.from("ihub_executive_snapshots").upsert({
    organization_id: organizationId,
    snapshot_date: new Date().toISOString().split("T")[0],
    connected_systems: snapshot.connectedSystems,
    connector_health_pct: snapshot.connectorHealthPct,
    failed_syncs: snapshot.failedSyncs,
    daily_transactions: snapshot.dailyTransactions,
    webhook_success_rate: snapshot.webhookSuccessRate,
    api_usage_count: snapshot.apiUsageCount,
    external_data_volume_mb: snapshot.externalDataVolumeMb,
    marketplace_revenue: snapshot.marketplaceRevenue,
  }, { onConflict: "organization_id,snapshot_date" });

  return snapshot;
}

export async function getExecutiveSnapshot(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_executive_snapshots")
    .select("*")
    .eq("organization_id", organizationId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getIntegrationRegistry(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_integration_registry")
    .select("*")
    .eq("organization_id", organizationId)
    .order("integration_name");
  return data ?? [];
}
