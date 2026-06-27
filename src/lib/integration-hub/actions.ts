"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canManageIntegrationHub } from "@/lib/integration-hub/access";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { installConnector } from "@/lib/integration-hub/connector-registry";
import { createCustomConnector } from "@/lib/integration-hub/connector-builder";
import { queueIntegrationSync } from "@/lib/integration-hub/sync-engine";
import { createOutgoingWebhook } from "@/lib/integration-hub/webhook-engine";
import { createApiKey } from "@/lib/integration-hub/api-gateway";
import { createSandboxKey } from "@/lib/integration-hub/developer-portal";
import { createMappingProfile } from "@/lib/integration-hub/mapping-studio";
import { publishEvent } from "@/lib/integration-hub/event-bus";
import { captureMonitoringSnapshot } from "@/lib/integration-hub/monitoring";
import { captureExecutiveSnapshot } from "@/lib/integration-hub/executive-dashboard";
import { installMarketplaceConnector } from "@/lib/integration-hub/marketplace";
import { storeCredential } from "@/lib/integration-hub/credential-vault";
import { runLabTest } from "@/lib/integration-hub/testing-lab";
import { createWorkflow, publishWorkflow, runWorkflow } from "@/lib/integration-hub/automation-studio";
import { captureCommandCenterSnapshot } from "@/lib/integration-hub/command-center";
import { provisionTenant } from "@/lib/integration-hub/tenant-provisioning";
import { createTenantBackup, scheduleRecoveryDrill } from "@/lib/integration-hub/disaster-recovery";
import type { CustomConnectorProtocol } from "@/lib/integration-hub/types";

async function resolveHub() {
  const ctx = await getIdentityContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) throw new Error("No organization");
  return { ctx, supabase, orgId };
}

function revalidateHub() {
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/integrations/dashboard");
  revalidatePath("/dashboard/integrations/command-center");
  revalidatePath("/dashboard/integrations/automation");
  revalidatePath("/dashboard/integrations/provisioning");
  revalidatePath("/dashboard/integrations/metering");
  revalidatePath("/dashboard/integrations/disaster-recovery");
}

export async function refreshIntegrationHubAction(): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await captureMonitoringSnapshot(supabase, orgId);
  await captureExecutiveSnapshot(supabase, orgId);
  revalidateHub();
}

export async function installConnectorAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await installConnector(supabase, {
    organizationId: orgId,
    connectorKey: formData.get("connector_key")?.toString() ?? "",
    instanceName: formData.get("instance_name")?.toString() ?? "Default",
    createdBy: ctx.effectiveUserId,
  });
  revalidatePath("/dashboard/integrations/connectors");
}

export async function createCustomConnectorAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await createCustomConnector(supabase, {
    organizationId: orgId,
    connectorName: formData.get("connector_name")?.toString() ?? "Custom",
    protocol: (formData.get("protocol")?.toString() ?? "rest") as CustomConnectorProtocol,
    createdBy: ctx.effectiveUserId,
  });
  revalidatePath("/dashboard/integrations/connectors");
}

export async function queueSyncAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await queueIntegrationSync(supabase, {
    organizationId: orgId,
    connectorInstanceId: formData.get("connector_instance_id")?.toString() || undefined,
    syncMode: (formData.get("sync_mode")?.toString() as "manual" | "scheduled" | "realtime") ?? "manual",
  });
  revalidatePath("/dashboard/integrations/sync");
}

export async function createWebhookAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await createOutgoingWebhook(supabase, {
    organizationId: orgId,
    webhookName: formData.get("webhook_name")?.toString() ?? "Webhook",
    endpointUrl: formData.get("endpoint_url")?.toString() ?? "",
    createdBy: ctx.effectiveUserId,
  });
  revalidatePath("/dashboard/integrations/webhooks");
}

export async function createApiKeyAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await createApiKey(supabase, {
    organizationId: orgId,
    keyName: formData.get("key_name")?.toString() ?? "API Key",
    createdBy: ctx.effectiveUserId,
  });
  revalidatePath("/dashboard/integrations/api");
}

export async function createSandboxKeyAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  await createSandboxKey(supabase, {
    organizationId: orgId,
    keyName: formData.get("key_name")?.toString() ?? "Sandbox",
  });
  revalidatePath("/dashboard/integrations/developer");
}

export async function createMappingProfileAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await createMappingProfile(supabase, {
    organizationId: orgId,
    profileName: formData.get("profile_name")?.toString() ?? "Mapping",
    sourceEntity: formData.get("source_entity")?.toString() ?? "source",
    targetEntity: formData.get("target_entity")?.toString() ?? "target",
    connectorKey: formData.get("connector_key")?.toString(),
    createdBy: ctx.effectiveUserId,
  });
  revalidatePath("/dashboard/integrations/mappings");
}

export async function installMarketplaceAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await installMarketplaceConnector(supabase, {
    organizationId: orgId,
    listingId: formData.get("listing_id")?.toString() ?? "",
    connectorKey: formData.get("connector_key")?.toString() ?? "",
    instanceName: formData.get("instance_name")?.toString() ?? "Marketplace",
  });
  revalidatePath("/dashboard/integrations/marketplace");
}

export async function rotateCredentialAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await storeCredential(supabase, {
    organizationId: orgId,
    vaultKey: formData.get("vault_key")?.toString() ?? "default",
    credentialType: formData.get("credential_type")?.toString() ?? "api_key",
  });
  revalidatePath("/dashboard/integrations/security");
}

export async function publishTestEventAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await publishEvent(supabase, {
    organizationId: orgId,
    eventType: formData.get("event_type")?.toString() ?? "student.created",
    eventSource: "testing_console",
    payload: { test: true },
  });
  revalidatePath("/dashboard/integrations/testing");
}

export async function runLabTestAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  await runLabTest(supabase, {
    organizationId: orgId,
    scenario: formData.get("scenario")?.toString() ?? "api_calls",
    actorId: ctx.effectiveUserId,
  });
  revalidatePath("/dashboard/integrations/testing");
}

export async function createWorkflowAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await createWorkflow(supabase, {
    organizationId: orgId,
    workflowKey: formData.get("workflow_key")?.toString() ?? `wf_${Date.now()}`,
    workflowName: formData.get("workflow_name")?.toString() ?? "New Workflow",
    triggerType: formData.get("trigger_type")?.toString() ?? "event",
    createdBy: ctx.effectiveUserId,
  });
  revalidatePath("/dashboard/integrations/automation");
}

export async function publishWorkflowAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  const id = formData.get("workflow_id")?.toString();
  if (id) await publishWorkflow(supabase, id);
  revalidatePath("/dashboard/integrations/automation");
}

export async function runWorkflowAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  const id = formData.get("workflow_id")?.toString();
  if (id) await runWorkflow(supabase, id, orgId);
  revalidatePath("/dashboard/integrations/automation");
}

export async function refreshCommandCenterAction(): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await captureCommandCenterSnapshot(supabase, orgId);
  revalidatePath("/dashboard/integrations/command-center");
}

export async function provisionTenantAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await provisionTenant(supabase, {
    tenantName: formData.get("tenant_name")?.toString() ?? "New Tenant",
    configPackage: formData.get("config_package")?.toString() ?? "enterprise",
    includeDemoData: formData.get("include_demo_data") === "on",
    createdBy: ctx.effectiveUserId,
  });
  revalidatePath("/dashboard/integrations/provisioning");
}

export async function createBackupAction(): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await createTenantBackup(supabase, orgId);
  revalidatePath("/dashboard/integrations/disaster-recovery");
}

export async function runRecoveryDrillAction(): Promise<void> {
  const { ctx, supabase, orgId } = await resolveHub();
  if (!canManageIntegrationHub(ctx)) return;
  await scheduleRecoveryDrill(supabase, orgId);
  revalidatePath("/dashboard/integrations/disaster-recovery");
}
