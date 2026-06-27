import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { captureMonitoringSnapshot } from "@/lib/integration-hub/monitoring";
import { captureExecutiveSnapshot } from "@/lib/integration-hub/executive-dashboard";
import { captureCommandCenterSnapshot } from "@/lib/integration-hub/command-center";
import { captureUsageMetering } from "@/lib/integration-hub/usage-metering";
import { seedDefaultRetentionPolicy } from "@/lib/integration-hub/event-bus-manager";
import { processIntegrationSyncQueue } from "@/lib/integration-hub/sync-engine";
import { seedDefaultSubscriptions } from "@/lib/integration-hub/event-bus";
import { getExpiringCredentials } from "@/lib/integration-hub/credential-vault";
import { getWorkflowAnalytics } from "@/lib/integration-hub/automation-studio";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

async function alertMissionControl(
  supabase: AuthClient,
  title: string,
  body: string,
  href: string,
  severity: "low" | "normal" | "high" | "critical" = "normal"
) {
  const { data: school } = await supabase.from("schools").select("id").limit(1).maybeSingle();
  await createMissionControlItem(supabase, {
    schoolId: school?.id ?? "",
    module: "executive",
    itemType: "executive_alert",
    title,
    body,
    href,
    entityType: "ihub_integration_registry",
    assignedRole: "CEO",
    severity,
  });
}

export async function syncIntegrationHub(supabase: AuthClient) {
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return;

  await seedDefaultSubscriptions(supabase, orgId);
  await seedDefaultRetentionPolicy(supabase, orgId);
  await processIntegrationSyncQueue(supabase);
  await captureMonitoringSnapshot(supabase, orgId);
  const [executive, commandCenter, expiring, workflows] = await Promise.all([
    captureExecutiveSnapshot(supabase, orgId),
    captureCommandCenterSnapshot(supabase, orgId),
    getExpiringCredentials(supabase, orgId),
    getWorkflowAnalytics(supabase, orgId),
  ]);
  await captureUsageMetering(supabase, orgId);

  if (commandCenter.connectorHealthPct < 80) {
    await alertMissionControl(supabase, "iPaaS: connector outage", `Connector health ${commandCenter.connectorHealthPct.toFixed(0)}%`, "/dashboard/integrations/command-center", "high");
  }
  if (executive.failedSyncs > 0) {
    await alertMissionControl(supabase, "iPaaS: sync conflicts", `${executive.failedSyncs} failed sync(s)`, "/dashboard/integrations/sync", "high");
  }
  if (commandCenter.deadLetterCount > 0) {
    await alertMissionControl(supabase, "iPaaS: dead letter queue", `${commandCenter.deadLetterCount} item(s) in DLQ`, "/dashboard/integrations/events", "high");
  }
  if (expiring.length > 0) {
    await alertMissionControl(supabase, "iPaaS: credential expiration", `${expiring.length} credential(s) expiring`, "/dashboard/integrations/security", "high");
  }
  if (workflows.failed > 0) {
    await alertMissionControl(supabase, "iPaaS: failed workflows", `${workflows.failed} workflow run(s) failed`, "/dashboard/integrations/automation", "high");
  }
  if (commandCenter.failurePct > 10) {
    await alertMissionControl(supabase, "iPaaS: webhook failures", `Failure rate ${commandCenter.failurePct}%`, "/dashboard/integrations/webhooks");
  }
}
