import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getRecentEvents, getEventSubscriptions, getEventCatalog } from "@/lib/integration-hub/event-bus";
import { getEventDeadLetter, getRetentionPolicies } from "@/lib/integration-hub/event-bus-manager";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";

export default async function IntegrationEventsPage() {
  await requirePagePermission(["integration.view", "integration.manage", "integration.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [events, subs, catalog, deadLetter, retention] = await Promise.all([
    getRecentEvents(supabase, orgId),
    orgId ? getEventSubscriptions(supabase, orgId) : [],
    Promise.resolve(getEventCatalog()),
    orgId ? getEventDeadLetter(supabase, orgId) : [],
    orgId ? getRetentionPolicies(supabase, orgId) : [],
  ]);

  return (
    <IntHubShell title="Enterprise Event Bus Manager" subtitle="Replay, versioning, ordering, filtering, dead-letter events, audit, retention policies, event search">
      <IntHubTable rows={events} columns={[
        { key: "event_type", label: "Event" }, { key: "event_source", label: "Source" },
        { key: "event_version", label: "Version" }, { key: "published_at", label: "Published" }, { key: "replayable", label: "Replayable" },
      ]} />
      <h2 className="font-semibold">Subscriptions</h2>
      <IntHubTable rows={subs} columns={[{ key: "subscription_name", label: "Name" }, { key: "target_type", label: "Target" }, { key: "is_active", label: "Active" }]} />
      <h2 className="font-semibold">Dead-Letter Events ({deadLetter.length})</h2>
      <IntHubTable rows={deadLetter} columns={[{ key: "event_type", label: "Event" }, { key: "reason", label: "Reason" }, { key: "created_at", label: "Time" }]} />
      <h2 className="font-semibold">Retention Policies</h2>
      <IntHubTable rows={retention} columns={[{ key: "event_type", label: "Event Type" }, { key: "retention_days", label: "Days" }, { key: "is_active", label: "Active" }]} />
      <h2 className="font-semibold">Event Catalog ({catalog.length})</h2>
      <ul className="grid gap-1 sm:grid-cols-2 text-sm">{catalog.map((e) => <li key={e.key} className="rounded bg-slate-50 px-3 py-1">{e.label} · {e.module}</li>)}</ul>
    </IntHubShell>
  );
}
