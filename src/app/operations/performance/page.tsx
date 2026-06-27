import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getLatestPlatformSnapshot } from "@/lib/operations-platform/monitoring";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsMetricsGrid } from "@/components/operations-platform/OpsPanels";

export default async function OperationsPerformancePage() {
  await requireOperationsPermission(["operations.view"]);
  const supabase = await createAuthClient();
  const snapshot = await getLatestPlatformSnapshot(supabase);

  return (
    <OpsShell title="Performance Center" subtitle="CPU, memory, response time, concurrent users, and regional performance">
      {snapshot && (
        <OpsMetricsGrid metrics={[
          ["CPU Usage", `${snapshot.cpu_usage_pct}%`], ["Memory Usage", `${snapshot.memory_usage_pct}%`],
          ["Avg Response", `${snapshot.avg_response_ms}ms`], ["Concurrent Users", snapshot.concurrent_users],
          ["Active Users", snapshot.active_users], ["Bandwidth (GB)", snapshot.bandwidth_used_gb],
        ]} />
      )}
    </OpsShell>
  );
}
