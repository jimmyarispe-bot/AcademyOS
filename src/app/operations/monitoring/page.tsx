import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getPlatformHistory } from "@/lib/operations-platform/monitoring";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsMonitoringPage() {
  await requireOperationsPermission(["operations.view"]);
  const supabase = await createAuthClient();
  const history = await getPlatformHistory(supabase);

  return (
    <OpsShell title="Platform Monitoring" subtitle="Real-time platform uptime, API health, database, queues, storage, bandwidth, and regional health">
      <OpsTable rows={history} columns={[
        { key: "snapshot_at", label: "Time" }, { key: "platform_uptime_pct", label: "Uptime" },
        { key: "api_uptime_pct", label: "API" }, { key: "database_health", label: "DB" },
        { key: "queue_health", label: "Queue" }, { key: "active_users", label: "Users" },
      ]} />
    </OpsShell>
  );
}
