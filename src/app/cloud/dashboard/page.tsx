import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getCloudHubSummary } from "@/lib/cloud-platform/hub";
import { getLatestPlatformHealth } from "@/lib/cloud-platform/monitoring";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudSummaryPanel, RefreshCloudButton } from "@/components/cloud-platform/CloudPanels";

export default async function CloudDashboardPage() {
  await requireCloudPermission(["cloud.admin", "cloud.analytics", "cloud.operations"]);
  const supabase = await createAuthClient();
  const [summary, health] = await Promise.all([getCloudHubSummary(supabase), getLatestPlatformHealth(supabase)]);

  return (
    <CloudShell title="Operations Dashboard" subtitle="Real-time SaaS metrics and platform overview">
      <div className="flex justify-end"><RefreshCloudButton /></div>
      <CloudSummaryPanel summary={summary} />
      {health && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">Latest platform health</h2>
          <p className="mt-2 text-slate-600">API: {health.api_health} · DB: {health.database_health} · Queue: {health.queue_health}</p>
        </section>
      )}
    </CloudShell>
  );
}
