import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getLatestCommandCenterSnapshot, getCommandCenterHistory } from "@/lib/integration-hub/command-center";
import { getExpiringCredentials } from "@/lib/integration-hub/credential-vault";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";
import { refreshCommandCenterAction } from "@/lib/integration-hub/actions";

export default async function CommandCenterPage() {
  await requirePagePermission(["integration.view", "integration.operations", "integration.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [snapshot, history, expiring] = await Promise.all([
    orgId ? getLatestCommandCenterSnapshot(supabase, orgId) : null,
    orgId ? getCommandCenterHistory(supabase, orgId) : [],
    orgId ? getExpiringCredentials(supabase, orgId) : [],
  ]);

  const metrics = snapshot ? [
    ["Connector Health", `${Number(snapshot.connector_health_pct).toFixed(0)}%`],
    ["API Health", `${Number(snapshot.api_health_pct).toFixed(0)}%`],
    ["Webhook Health", `${Number(snapshot.webhook_health_pct).toFixed(0)}%`],
    ["Sync Queue", snapshot.sync_queue_depth],
    ["Retry Queue", snapshot.retry_queue_depth],
    ["Dead Letter", snapshot.dead_letter_count],
    ["Daily Transactions", snapshot.daily_transactions],
    ["Hourly Transactions", snapshot.hourly_transactions],
    ["Avg Latency", `${snapshot.avg_latency_ms}ms`],
    ["Success", `${snapshot.success_pct}%`],
    ["Failure", `${snapshot.failure_pct}%`],
    ["Storage (MB)", snapshot.storage_usage_mb],
    ["Bandwidth (MB)", snapshot.bandwidth_usage_mb],
    ["Uptime", `${snapshot.historical_uptime_pct}%`],
  ] : [];

  return (
    <IntHubShell title="Integration Command Center" subtitle="Enterprise operations dashboard — connector, API, and webhook health, queues, latency, storage, bandwidth, and uptime">
      <form action={refreshCommandCenterAction}>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Refresh snapshot · Export analytics</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, val]) => (
          <div key={String(label)} className="rounded-xl border bg-white p-3 text-sm">
            <p className="text-slate-500">{String(label)}</p>
            <p className="text-lg font-bold">{String(val)}</p>
          </div>
        ))}
      </div>
      <section>
        <h2 className="mb-2 font-semibold">Credential Expiration ({expiring.length})</h2>
        <IntHubTable rows={expiring} columns={[{ key: "vault_key", label: "Credential" }, { key: "credential_type", label: "Type" }, { key: "expires_at", label: "Expires" }]} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Historical Snapshots</h2>
        <IntHubTable rows={history} columns={[
          { key: "snapshot_at", label: "Time" }, { key: "connector_health_pct", label: "Connectors" },
          { key: "success_pct", label: "Success %" }, { key: "dead_letter_count", label: "DLQ" },
        ]} />
      </section>
    </IntHubShell>
  );
}
