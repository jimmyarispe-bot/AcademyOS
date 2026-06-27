import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getLatestRevenue, getRevenueSnapshots } from "@/lib/operations-platform/revenue";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsMetricsGrid, OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsRevenuePage() {
  await requireOperationsPermission(["operations.billing", "operations.executive"]);
  const supabase = await createAuthClient();
  const [latest, history] = await Promise.all([getLatestRevenue(supabase), getRevenueSnapshots(supabase)]);

  return (
    <OpsShell title="Revenue Center" subtitle="MRR, ARR, NRR, GRR, CLV, CAC, expansion, marketplace, professional services, training, and support revenue">
      {latest && (
        <OpsMetricsGrid metrics={[
          ["MRR", `$${Number(latest.mrr).toFixed(0)}`], ["ARR", `$${Number(latest.arr).toFixed(0)}`],
          ["Growth", `${latest.revenue_growth_pct}%`], ["NRR", `${latest.net_revenue_retention_pct}%`],
          ["GRR", `${latest.gross_revenue_retention_pct}%`], ["CLV", `$${Number(latest.customer_lifetime_value).toFixed(0)}`],
          ["CAC", `$${Number(latest.customer_acquisition_cost).toFixed(0)}`], ["Expansion", `$${Number(latest.expansion_revenue).toFixed(0)}`],
          ["Marketplace", `$${Number(latest.marketplace_revenue).toFixed(0)}`], ["Pro Services", `$${Number(latest.professional_services_revenue).toFixed(0)}`],
          ["Implementation", `$${Number(latest.implementation_revenue).toFixed(0)}`], ["Training", `$${Number(latest.training_revenue).toFixed(0)}`],
        ]} />
      )}
      <OpsTable rows={history} columns={[
        { key: "snapshot_date", label: "Date" }, { key: "mrr", label: "MRR" },
        { key: "arr", label: "ARR" }, { key: "revenue_growth_pct", label: "Growth %" },
      ]} />
    </OpsShell>
  );
}
