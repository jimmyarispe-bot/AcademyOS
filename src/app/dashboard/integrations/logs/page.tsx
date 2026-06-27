import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getSyncAuditTrail } from "@/lib/integration-hub/sync-engine";
import { getApiAuditLog } from "@/lib/integration-hub/api-gateway";
import { getWebhookDeliveries } from "@/lib/integration-hub/webhook-engine";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";

export default async function IntegrationLogsPage() {
  await requirePagePermission(["integration.view", "integration.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const [sync, api, webhooks] = await Promise.all([
    getSyncAuditTrail(supabase, orgId),
    getApiAuditLog(supabase, orgId),
    getWebhookDeliveries(supabase, orgId),
  ]);

  return (
    <IntHubShell title="Integration Logs" subtitle="Sync audit trail, API audit log, webhook delivery history">
      <section><h2 className="mb-2 font-semibold">Sync Audit</h2>
        <IntHubTable rows={sync} columns={[{ key: "sync_type", label: "Type" }, { key: "status", label: "Status" }, { key: "started_at", label: "Started" }]} /></section>
      <section><h2 className="mb-2 font-semibold">API Audit</h2>
        <IntHubTable rows={api} columns={[{ key: "method", label: "Method" }, { key: "path", label: "Path" }, { key: "created_at", label: "Time" }]} /></section>
      <section><h2 className="mb-2 font-semibold">Webhook Deliveries</h2>
        <IntHubTable rows={webhooks} columns={[{ key: "event_type", label: "Event" }, { key: "status", label: "Status" }]} /></section>
    </IntHubShell>
  );
}
