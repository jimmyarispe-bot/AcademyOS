"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canImportData, canExportData, canManageDataPlatform, canAdminDataPlatform } from "@/lib/enterprise-data/access";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { createImportBatch, parseAndStageImport, commitImportBatch, rollbackImportBatch } from "@/lib/enterprise-data/import-engine";
import { runExport } from "@/lib/enterprise-data/export-engine";
import { saveMappingTemplate, getDefaultMappings } from "@/lib/enterprise-data/mapping-engine";
import { validateImportBatch } from "@/lib/enterprise-data/validation-engine";
import { createConnectorInstance } from "@/lib/enterprise-data/connectors";
import { queueSyncJob, runSyncJob } from "@/lib/enterprise-data/sync-engine";
import { createApiKey, revokeApiKey } from "@/lib/enterprise-data/api-services";
import { createWebhook, testWebhook } from "@/lib/enterprise-data/webhook-services";
import { createBackup, restoreBackup } from "@/lib/enterprise-data/backup-engine";
import { createArchive } from "@/lib/enterprise-data/archive-engine";
import { startCloneJob } from "@/lib/enterprise-data/clone-engine";
import { startMigrationSession, advanceMigrationStep, rollbackMigration } from "@/lib/enterprise-data/migration-wizard";
import { syncEnterpriseDataPlatform } from "@/lib/enterprise-data/automation";
import { computeQualitySnapshot } from "@/lib/enterprise-data/quality";
import { captureWarehouseSnapshots } from "@/lib/enterprise-data/warehouse";
import type { EdpImportType, EdpSourceFormat, EdpExportFormat, MigrationStep } from "@/lib/enterprise-data/types";

async function resolveOrg(formOrgId?: string | null) {
  const ctx = await getIdentityContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createAuthClient();
  const orgId = formOrgId || (await getPrimaryOrganizationId(supabase));
  if (!orgId) throw new Error("Organization not found");
  return { ctx, supabase, orgId };
}

export async function runImportAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canImportData(ctx)) return;

  const importType = (formData.get("import_type")?.toString() ?? "student") as EdpImportType;
  const sourceFormat = (formData.get("source_format")?.toString() ?? "csv") as EdpSourceFormat;
  const content = formData.get("file_content")?.toString() ?? "";

  const batch = await createImportBatch(supabase, {
    organizationId: orgId,
    importType,
    sourceFormat,
    fileName: formData.get("file_name")?.toString(),
    importedBy: ctx.effectiveUserId,
    schoolId: formData.get("school_id")?.toString(),
  });

  if (batch.error || !batch.batchId) return;

  const mappingsJson = formData.get("field_mappings")?.toString();
  const mappings = mappingsJson ? JSON.parse(mappingsJson) : getDefaultMappings(importType);

  await parseAndStageImport(supabase, batch.batchId, content, mappings);
  await validateImportBatch(supabase, batch.batchId, importType, mappings);

  if (formData.get("commit") === "true") {
    await commitImportBatch(supabase, batch.batchId, importType);
  }

  revalidatePath("/dashboard/data");
  revalidatePath("/dashboard/data/import");
}

export async function runExportAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canExportData(ctx)) return;

  const result = await runExport(supabase, {
    organizationId: orgId,
    exportType: formData.get("export_type")?.toString() ?? "students",
    exportFormat: (formData.get("export_format")?.toString() ?? "csv") as EdpExportFormat,
    schoolId: formData.get("school_id")?.toString(),
    exportedBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/data/export");
}

export async function saveMappingAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManageDataPlatform(ctx)) return;

  const mappings = JSON.parse(formData.get("field_mappings")?.toString() ?? "[]");
  await saveMappingTemplate(supabase, {
    organizationId: orgId,
    templateName: formData.get("template_name")?.toString() ?? "Default",
    importType: formData.get("import_type")?.toString() ?? "student",
    fieldMappings: mappings,
    isDefault: formData.get("is_default") === "true",
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/data/mappings");
}

export async function createConnectorAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManageDataPlatform(ctx)) return;

  await createConnectorInstance(supabase, {
    organizationId: orgId,
    connectorKey: formData.get("connector_key")?.toString() ?? "",
    instanceName: formData.get("instance_name")?.toString() ?? "Default",
    syncDirection: formData.get("sync_direction")?.toString(),
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/data/connectors");
}

export async function runSyncAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManageDataPlatform(ctx)) return;

  const job = await queueSyncJob(supabase, {
    organizationId: orgId,
    connectorInstanceId: formData.get("connector_instance_id")?.toString(),
    syncType: formData.get("sync_type")?.toString() ?? "manual",
    direction: formData.get("direction")?.toString(),
  });

  if (job.jobId) await runSyncJob(supabase, job.jobId);
  revalidatePath("/dashboard/data/connectors");
}

export async function createApiKeyAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canAdminDataPlatform(ctx)) return;

  await createApiKey(supabase, {
    organizationId: orgId,
    keyName: formData.get("key_name")?.toString() ?? "API Key",
    scopes: JSON.parse(formData.get("scopes")?.toString() ?? '["read"]'),
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/data/api");
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canAdminDataPlatform(ctx)) return;
  await revokeApiKey(supabase, formData.get("key_id")?.toString() ?? "");
  revalidatePath("/dashboard/data/api");
}

export async function createWebhookAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManageDataPlatform(ctx)) return;

  await createWebhook(supabase, {
    organizationId: orgId,
    webhookName: formData.get("webhook_name")?.toString() ?? "Webhook",
    direction: (formData.get("direction")?.toString() ?? "outgoing") as "incoming" | "outgoing",
    endpointUrl: formData.get("endpoint_url")?.toString(),
    eventTypes: JSON.parse(formData.get("event_types")?.toString() ?? "[]"),
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/data/webhooks");
}

export async function testWebhookAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canManageDataPlatform(ctx)) return;
  await testWebhook(supabase, formData.get("webhook_id")?.toString() ?? "");
  revalidatePath("/dashboard/data/webhooks");
}

export async function createBackupAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canExportData(ctx)) return;

  await createBackup(supabase, {
    organizationId: orgId,
    backupType: formData.get("backup_type")?.toString(),
    schoolId: formData.get("school_id")?.toString(),
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/data/backups");
}

export async function restoreBackupAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canAdminDataPlatform(ctx)) return;
  await restoreBackup(supabase, formData.get("backup_id")?.toString() ?? "");
  revalidatePath("/dashboard/data/backups");
}

export async function createArchiveAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManageDataPlatform(ctx)) return;

  await createArchive(supabase, {
    organizationId: orgId,
    archiveType: formData.get("archive_type")?.toString() ?? "documents",
    retentionPolicy: formData.get("retention_policy")?.toString(),
    archivedBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/data/archive");
}

export async function startCloneAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canAdminDataPlatform(ctx)) return;

  await startCloneJob(supabase, {
    organizationId: orgId,
    cloneType: formData.get("clone_type")?.toString() ?? "organization",
    sourceScope: JSON.parse(formData.get("source_scope")?.toString() ?? "{}"),
    targetScope: JSON.parse(formData.get("target_scope")?.toString() ?? "{}"),
    includeUsers: formData.get("include_users") === "true",
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/data/clone");
}

export async function startMigrationAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canImportData(ctx)) return;

  await startMigrationSession(supabase, { organizationId: orgId, startedBy: ctx.effectiveUserId });
  revalidatePath("/dashboard/data/import");
}

export async function advanceMigrationAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canImportData(ctx)) return;

  await advanceMigrationStep(
    supabase,
    formData.get("session_id")?.toString() ?? "",
    formData.get("step")?.toString() as MigrationStep,
    JSON.parse(formData.get("session_data")?.toString() ?? "{}")
  );

  revalidatePath("/dashboard/data/import");
}

export async function rollbackMigrationAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canImportData(ctx)) return;

  await rollbackMigration(
    supabase,
    formData.get("session_id")?.toString() ?? "",
    formData.get("batch_id")?.toString()
  );
  await rollbackImportBatch(supabase, formData.get("batch_id")?.toString() ?? "");
  revalidatePath("/dashboard/data/import");
}

export async function refreshEdpAction(): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg();
  if (!canManageDataPlatform(ctx)) return;

  await syncEnterpriseDataPlatform(supabase);
  await computeQualitySnapshot(supabase, orgId);
  await captureWarehouseSnapshots(supabase, orgId);

  revalidatePath("/dashboard/data");
}
