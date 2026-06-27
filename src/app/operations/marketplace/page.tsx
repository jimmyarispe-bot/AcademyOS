import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getMarketplaceBusiness, getCloudMarketplaceModules } from "@/lib/operations-platform/marketplace-business";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsMetricsGrid, OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsMarketplacePage() {
  await requireOperationsPermission(["operations.analytics", "operations.billing"]);
  const supabase = await createAuthClient();
  const [business, modules] = await Promise.all([getMarketplaceBusiness(supabase), getCloudMarketplaceModules(supabase)]);

  return (
    <OpsShell title="Marketplace Business" subtitle="Paid modules, subscriptions, revenue sharing, developer payments, downloads, ratings, reviews">
      {business && (
        <OpsMetricsGrid metrics={[
          ["Paid Modules", business.paid_modules], ["Active Subscriptions", business.active_subscriptions],
          ["Revenue Sharing", `$${Number(business.revenue_sharing_total).toFixed(0)}`],
          ["Developer Payments", `$${Number(business.developer_payments).toFixed(0)}`],
          ["Total Downloads", business.total_downloads], ["Avg Rating", business.avg_rating],
        ]} />
      )}
      <OpsTable rows={modules} columns={[
        { key: "display_name", label: "Module" }, { key: "billing_addon_usd", label: "Price" },
        { key: "version", label: "Version" }, { key: "is_published", label: "Published" },
      ]} />
    </OpsShell>
  );
}
