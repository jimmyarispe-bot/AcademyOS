import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getEventCatalog } from "@/lib/integration-hub/event-bus";
import { getTestingScenarios } from "@/lib/integration-hub/testing-lab";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { publishTestEventAction, runLabTestAction } from "@/lib/integration-hub/actions";

export default async function IntegrationTestingPage() {
  await requirePagePermission(["integration.manage", "integration.admin", "integration.developer", "developer.portal"]);
  const supabase = await createAuthClient();
  await getPrimaryOrganizationId(supabase);
  const catalog = getEventCatalog();
  const scenarios = getTestingScenarios();

  return (
    <IntHubShell title="Developer Testing Lab" subtitle="Test API calls, webhook delivery, connector health, authentication, sync, retry, load, and error handling">
      <form action={runLabTestAction} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <select name="scenario" className="rounded-lg border px-3 py-2 text-sm">
          {scenarios.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Run lab test</button>
      </form>
      <form action={publishTestEventAction} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <select name="event_type" className="rounded-lg border px-3 py-2 text-sm">
          {catalog.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>
        <button type="submit" className="rounded-lg border border-indigo-600 px-4 py-2 text-sm text-indigo-600">Publish test event</button>
      </form>
    </IntHubShell>
  );
}
