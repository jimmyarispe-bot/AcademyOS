import Link from "next/link";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getDevOpsDashboard } from "@/lib/integration-hub/devops-center";
import { getApiAuditLog } from "@/lib/integration-hub/api-gateway";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";

export default async function DevOpsCenterPage() {
  await requirePagePermission(["integration.developer", "integration.operations", "developer.portal", "integration.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const [dashboard, audit] = await Promise.all([
    getDevOpsDashboard(supabase, orgId),
    getApiAuditLog(supabase, orgId, 20),
  ]);

  return (
    <IntHubShell title="Developer Operations Center" subtitle="Developer dashboard, API explorer, OpenAPI docs, SDK downloads, sandbox, test console, webhook simulator, analytics">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="rounded-xl border bg-white p-4"><p className="text-slate-500">API Calls</p><p className="text-2xl font-bold">{dashboard.usage.apiCalls}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-slate-500">Workflow Success</p><p className="text-2xl font-bold">{dashboard.workflowSuccessRate.toFixed(0)}%</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-slate-500">Certified Connectors</p><p className="text-2xl font-bold">{dashboard.certifiedConnectors}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-slate-500">Sandbox Keys</p><p className="text-2xl font-bold">{dashboard.sandboxKeys}</p></div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={dashboard.openApiUrl} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">OpenAPI / Swagger Docs</Link>
        <Link href="/dashboard/integrations/sdk" className="rounded-lg border px-4 py-2">SDK Downloads</Link>
        <Link href="/dashboard/integrations/testing" className="rounded-lg border px-4 py-2">Test Console</Link>
        <Link href="/dashboard/integrations/developer" className="rounded-lg border px-4 py-2">Developer Portal</Link>
      </div>
      <section>
        <h2 className="mb-2 font-semibold">API Analytics — Recent Calls</h2>
        <IntHubTable rows={audit} columns={[
          { key: "method", label: "Method" }, { key: "path", label: "Path" },
          { key: "status_code", label: "Status" }, { key: "latency_ms", label: "Latency" }, { key: "created_at", label: "Time" },
        ]} />
      </section>
    </IntHubShell>
  );
}
