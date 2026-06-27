import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getApiKeys, getOAuthClients, getApiAuditLog } from "@/lib/integration-hub/api-gateway";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";
import { createApiKeyAction } from "@/lib/integration-hub/actions";
import { API_VERSIONS } from "@/lib/integration-hub/types";

export default async function IntegrationApiPage() {
  await requirePagePermission(["integration.view", "integration.admin", "developer.portal"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const [keys, oauth, audit] = await Promise.all([
    getApiKeys(supabase, orgId),
    getOAuthClients(supabase, orgId),
    getApiAuditLog(supabase, orgId),
  ]);

  return (
    <IntHubShell title="Open API Platform" subtitle="REST API, OAuth 2.0, API keys, rate limiting, tenant isolation, GraphQL-ready architecture">
      <p className="text-sm text-slate-600">Versions: {API_VERSIONS.join(", ")} · Credentials encrypted · Secret rotation supported · Every call audited</p>
      <form action={createApiKeyAction} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <input name="key_name" placeholder="API key name" className="rounded-lg border px-3 py-2 text-sm" required />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create API key</button>
      </form>
      <IntHubTable rows={keys} columns={[{ key: "key_name", label: "Name" }, { key: "key_prefix", label: "Prefix" }, { key: "rate_limit_per_minute", label: "Rate/min" }, { key: "is_active", label: "Active" }]} />
      <h2 className="font-semibold">OAuth 2.0 Clients</h2>
      <IntHubTable rows={oauth} columns={[{ key: "client_name", label: "Client" }, { key: "client_id", label: "Client ID" }, { key: "api_version", label: "Version" }]} />
      <h2 className="font-semibold">API Audit Log</h2>
      <IntHubTable rows={audit} columns={[{ key: "method", label: "Method" }, { key: "path", label: "Path" }, { key: "status_code", label: "Status" }, { key: "latency_ms", label: "Latency" }]} />
    </IntHubShell>
  );
}
