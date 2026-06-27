import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getProductAnalytics } from "@/lib/cloud-platform/analytics";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsAnalyticsPage() {
  await requireOperationsPermission(["operations.analytics"]);
  const supabase = await createAuthClient();
  const analytics = await getProductAnalytics(supabase);

  return (
    <OpsShell title="Platform Analytics" subtitle="Feature usage, adoption trends, and product analytics across all organizations">
      <OpsTable rows={analytics} columns={[
        { key: "feature_key", label: "Feature" }, { key: "usage_count", label: "Usage" },
        { key: "unique_users", label: "Users" }, { key: "avg_session_seconds", label: "Avg Session" },
      ]} />
    </OpsShell>
  );
}
