import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getUsageAnalytics, getProductAnalytics } from "@/lib/cloud-platform/analytics";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";

export default async function CloudAnalyticsPage() {
  await requireCloudPermission(["cloud.admin", "cloud.analytics"]);
  const supabase = await createAuthClient();
  const [usage, product] = await Promise.all([getUsageAnalytics(supabase), getProductAnalytics(supabase)]);

  return (
    <CloudShell title="Usage & Product Analytics" subtitle="DAU, MAU, module usage, feature adoption, retention curves">
      <section>
        <h2 className="mb-3 font-semibold">Usage analytics</h2>
        <CloudTable rows={usage} columns={[
          { key: "metric_date", label: "Date" }, { key: "daily_active_users", label: "DAU" },
          { key: "monthly_active_users", label: "MAU" }, { key: "automation_volume", label: "Automation" },
        ]} />
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Product analytics</h2>
        <CloudTable rows={product} columns={[
          { key: "feature_key", label: "Feature" }, { key: "usage_count", label: "Usage" }, { key: "unique_users", label: "Users" },
        ]} />
      </section>
    </CloudShell>
  );
}
