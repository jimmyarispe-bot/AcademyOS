import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getUsageAnalytics } from "@/lib/cloud-platform/analytics";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsUsagePage() {
  await requireOperationsPermission(["operations.analytics"]);
  const supabase = await createAuthClient();
  const usage = await getUsageAnalytics(supabase);

  return (
    <OpsShell title="Usage Analytics" subtitle="Daily and monthly active users, module usage, storage, imports, exports, and automation volume">
      <OpsTable rows={usage} columns={[
        { key: "metric_date", label: "Date" }, { key: "daily_active_users", label: "DAU" },
        { key: "monthly_active_users", label: "MAU" }, { key: "storage_bytes", label: "Storage" },
        { key: "automation_volume", label: "Automation" },
      ]} />
    </OpsShell>
  );
}
