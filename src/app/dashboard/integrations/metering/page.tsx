import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getUsageMetering, getMeteringDimensions } from "@/lib/integration-hub/usage-metering";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";

export default async function UsageMeteringPage() {
  await requirePagePermission(["integration.view", "integration.operations", "integration.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [metering, dimensions] = await Promise.all([
    orgId ? getUsageMetering(supabase, orgId) : [],
    Promise.resolve(getMeteringDimensions()),
  ]);
  const latest = metering[0];

  return (
    <IntHubShell title="Usage Metering Platform" subtitle="Track users, API calls, webhooks, connector executions, sync jobs, workflow runs, storage, bandwidth, and subscription limits">
      {latest && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {[
            ["Users", latest.users_count], ["Students", latest.students_count],
            ["API Calls", latest.api_calls], ["Webhooks", latest.webhook_calls],
            ["Sync Jobs", latest.sync_jobs], ["Workflow Runs", latest.workflow_runs],
            ["Storage (MB)", latest.storage_mb], ["Bandwidth (MB)", latest.bandwidth_mb],
          ].map(([label, val]) => (
            <div key={String(label)} className="rounded-xl border bg-white p-4">
              <p className="text-slate-500">{String(label)}</p>
              <p className="text-2xl font-bold">{String(val)}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-sm text-slate-600">Metered dimensions: {dimensions.join(", ")}</p>
      <IntHubTable rows={metering} columns={[
        { key: "meter_date", label: "Date" }, { key: "api_calls", label: "API" },
        { key: "webhook_calls", label: "Webhooks" }, { key: "connector_executions", label: "Connectors" },
        { key: "workflow_runs", label: "Workflows" }, { key: "storage_mb", label: "Storage" },
      ]} />
    </IntHubShell>
  );
}
