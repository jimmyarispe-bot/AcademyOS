import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getIntegrationHubSummary } from "@/lib/integration-hub/monitoring";
import { getExecutiveSnapshot, getIntegrationRegistry } from "@/lib/integration-hub/executive-dashboard";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { HubSummaryPanel, ExecutiveDashboardPanel, MonitoringPanel, RefreshHubButton, AiReadinessNote } from "@/components/integration-hub/IntHubPanels";
import Link from "next/link";
import { IHUB_NAV } from "@/lib/integration-hub/types";

export default async function IntegrationDashboardPage() {
  await requirePagePermission(["integration.view", "integration.manage", "integration.admin", "integration.developer", "developer.portal", "data.view"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [summary, executive, registry] = await Promise.all([
    orgId ? getIntegrationHubSummary(supabase, orgId) : null,
    orgId ? getExecutiveSnapshot(supabase, orgId) : null,
    orgId ? getIntegrationRegistry(supabase, orgId) : [],
  ]);
  const links = IHUB_NAV.filter((l) => l.href !== "/dashboard/integrations/dashboard");

  return (
    <IntHubShell title="Integration Executive Dashboard" subtitle="Connected systems, connector health, transactions, webhooks, API usage, and marketplace revenue">
      <div className="flex flex-wrap gap-3"><RefreshHubButton /></div>
      <ExecutiveDashboardPanel snapshot={executive} />
      <HubSummaryPanel summary={summary} />
      <MonitoringPanel summary={summary} />
      <AiReadinessNote />
      {registry.length > 0 && (
        <p className="text-sm text-slate-600">{registry.length} registered integration(s) in tenant registry.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-2xl border bg-white p-4 shadow-sm hover:border-indigo-300">
            <h3 className="font-semibold">{l.label}</h3>
          </Link>
        ))}
      </div>
    </IntHubShell>
  );
}
