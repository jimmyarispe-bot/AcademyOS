import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getDeveloperApps, getSandboxKeys, getUsageAnalytics } from "@/lib/integration-hub/developer-portal";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";
import { createSandboxKeyAction } from "@/lib/integration-hub/actions";

export default async function IntegrationDeveloperPage() {
  await requirePagePermission(["integration.developer", "developer.portal", "integration.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const [apps, sandbox, usage] = await Promise.all([
    getDeveloperApps(supabase, orgId),
    getSandboxKeys(supabase, orgId),
    getUsageAnalytics(supabase, orgId),
  ]);

  return (
    <IntHubShell title="Developer Portal" subtitle="API docs, webhook docs, authentication guide, sandbox, testing console, usage analytics, rate-limit dashboard, API explorer">
      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div className="rounded-xl border bg-white p-4"><p className="text-slate-500">API Calls</p><p className="text-2xl font-bold">{usage.apiCalls}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-slate-500">Events Published</p><p className="text-2xl font-bold">{usage.eventsPublished}</p></div>
      </div>
      <div className="rounded-xl border bg-slate-50 p-4 text-sm">
        <p className="font-medium">Documentation</p>
        <ul className="mt-2 list-disc pl-5 text-slate-600">
          <li>REST API v1 — OAuth 2.0, OpenID Connect, API Keys, JWT, scoped tokens</li>
          <li>Webhook signing secrets, retries, replay, dead-letter queue</li>
          <li>GraphQL-ready architecture (future)</li>
        </ul>
      </div>
      <form action={createSandboxKeyAction} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <input name="key_name" placeholder="Sandbox key name" className="rounded-lg border px-3 py-2 text-sm" required />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create sandbox key</button>
      </form>
      <IntHubTable rows={sandbox} columns={[{ key: "key_name", label: "Key" }, { key: "key_prefix", label: "Prefix" }, { key: "expires_at", label: "Expires" }]} />
      <IntHubTable rows={apps} columns={[{ key: "app_name", label: "App" }, { key: "app_type", label: "Type" }, { key: "status", label: "Status" }]} />
    </IntHubShell>
  );
}
