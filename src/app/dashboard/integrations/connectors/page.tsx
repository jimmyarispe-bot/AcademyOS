import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getConnectorLibrary, getHealthcareConnectors, getStateFundingConnectors, getInstalledConnectors } from "@/lib/integration-hub/connector-registry";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";
import { installConnectorAction, createCustomConnectorAction } from "@/lib/integration-hub/actions";
import { STATE_FUNDING_TRACKING, CUSTOM_CONNECTOR_PROTOCOLS } from "@/lib/integration-hub/types";
import { getCustomConnectors } from "@/lib/integration-hub/connector-builder";

export default async function ConnectorsPage() {
  await requirePagePermission(["integration.view", "integration.manage", "integration.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [library, healthcare, stateFunding, installed, custom] = await Promise.all([
    getConnectorLibrary(supabase),
    getHealthcareConnectors(supabase),
    getStateFundingConnectors(supabase),
    orgId ? getInstalledConnectors(supabase, orgId) : [],
    orgId ? getCustomConnectors(supabase, orgId) : [],
  ]);

  return (
    <IntHubShell title="Connector Library" subtitle="Production connectors — Google, Microsoft, QuickBooks, SIS, LMS, healthcare, and state funding">
      <form action={installConnectorAction} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <select name="connector_key" className="rounded-lg border px-3 py-2 text-sm" required>
          <option value="">Select connector…</option>
          {library.map((c) => <option key={c.connector_key} value={c.connector_key}>{c.display_name}</option>)}
        </select>
        <input name="instance_name" placeholder="Instance name" className="rounded-lg border px-3 py-2 text-sm" required />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Install</button>
      </form>
      <section><h2 className="mb-2 font-semibold">Installed ({installed.length})</h2>
        <IntHubTable rows={installed} columns={[{ key: "instance_name", label: "Instance" }, { key: "connector_key", label: "Connector" }, { key: "status", label: "Status" }, { key: "health_status", label: "Health" }]} /></section>
      <section><h2 className="mb-2 font-semibold">Healthcare Connectors</h2>
        <IntHubTable rows={healthcare} columns={[{ key: "display_name", label: "Connector" }, { key: "supports_sync", label: "Sync" }]} /></section>
      <section><h2 className="mb-2 font-semibold">Custom Connector Builder (no-code)</h2>
        <form action={createCustomConnectorAction} className="mb-3 flex flex-wrap gap-3 rounded-xl border bg-white p-4">
          <input name="connector_name" placeholder="Connector name" className="rounded-lg border px-3 py-2 text-sm" required />
          <select name="protocol" className="rounded-lg border px-3 py-2 text-sm">
            {CUSTOM_CONNECTOR_PROTOCOLS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Build connector</button>
        </form>
        <IntHubTable rows={custom} columns={[{ key: "connector_name", label: "Name" }, { key: "protocol", label: "Protocol" }, { key: "status", label: "Status" }]} /></section>
      <section><h2 className="mb-2 font-semibold">State Funding — tracks {STATE_FUNDING_TRACKING.join(", ")}</h2>
        <IntHubTable rows={stateFunding} columns={[{ key: "display_name", label: "Provider" }, { key: "supports_import", label: "Import" }]} /></section>
    </IntHubShell>
  );
}
