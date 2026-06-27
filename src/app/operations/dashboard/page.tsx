import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getOperationsHubSummary, getLatestExecutiveSnapshot } from "@/lib/operations-platform/hub";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsSummaryPanel, OpsMetricsGrid, RefreshOpsButton } from "@/components/operations-platform/OpsPanels";

export default async function OperationsDashboardPage() {
  await requireOperationsPermission(["operations.view", "operations.executive"]);
  const supabase = await createAuthClient();
  const [summary, executive] = await Promise.all([getOperationsHubSummary(supabase), getLatestExecutiveSnapshot(supabase)]);

  return (
    <OpsShell title="Executive Operations Dashboard" subtitle="Organizations, revenue, platform health, customer health, support, marketplace, and forecast">
      <RefreshOpsButton />
      <OpsSummaryPanel summary={summary} />
      {executive && (
        <OpsMetricsGrid metrics={[
          ["Organizations", executive.organizations_count], ["Students Managed", executive.students_managed],
          ["Employees Managed", executive.employees_managed], ["Churn", `${executive.churn_pct}%`],
          ["Renewals Due", executive.renewals_due], ["Implementation Pipeline", executive.implementation_pipeline],
          ["Forecast MRR", `$${Number(executive.forecast_mrr).toFixed(0)}`], ["Marketplace Revenue", `$${Number(executive.marketplace_revenue).toFixed(0)}`],
        ]} />
      )}
    </OpsShell>
  );
}
