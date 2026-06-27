import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getLatestPlatformHealth } from "@/lib/cloud-platform/monitoring";
import { getLatestPlatformSnapshot } from "@/lib/operations-platform/monitoring";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsMetricsGrid } from "@/components/operations-platform/OpsPanels";

export default async function OperationsPlatformPage() {
  await requireOperationsPermission(["operations.view"]);
  const supabase = await createAuthClient();
  const [cloud, ops] = await Promise.all([getLatestPlatformHealth(supabase), getLatestPlatformSnapshot(supabase)]);

  return (
    <OpsShell title="Platform Overview" subtitle="Platform uptime, API, database, queue, storage, bandwidth, and regional health">
      <OpsMetricsGrid metrics={[
        ["Platform Uptime", ops ? `${ops.platform_uptime_pct}%` : "—"],
        ["API Uptime", ops ? `${ops.api_uptime_pct}%` : "—"],
        ["Database", ops?.database_health ?? cloud?.database_health ?? "—"],
        ["Queue", ops?.queue_health ?? cloud?.queue_health ?? "—"],
        ["Storage (GB)", ops?.storage_used_gb ?? "—"],
        ["Bandwidth (GB)", ops?.bandwidth_used_gb ?? "—"],
        ["Active Users", ops?.active_users ?? "—"],
        ["Orgs Online", ops?.organizations_online ?? "—"],
      ]} />
    </OpsShell>
  );
}
