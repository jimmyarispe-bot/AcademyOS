"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canManageConfiguration, canLaunchOrganization } from "@/lib/configuration/access";
import { getPrimaryOrganizationId } from "@/lib/configuration/context";
import { saveConfigSection } from "@/lib/configuration/sections";
import type { ConfigSectionKey } from "@/lib/configuration/types";
import { installModule, disableModule } from "@/lib/configuration/modules";
import { advanceSetupStep, startSetupSession } from "@/lib/configuration/setup-wizard";
import type { SetupStepKey } from "@/lib/configuration/types";
import { launchOrganization } from "@/lib/configuration/go-live";
import { importConfigurationPackage, parseConfigurationJson } from "@/lib/configuration/import-export";
import { rollbackConfigVersion } from "@/lib/configuration/versioning";

async function resolveOrg(formOrgId?: string | null) {
  const ctx = await getIdentityContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createAuthClient();
  const orgId = formOrgId || (await getPrimaryOrganizationId(supabase));
  if (!orgId) throw new Error("Organization not found");
  return { ctx, supabase, orgId };
}

export async function saveConfigSectionAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManageConfiguration(ctx)) return;

  const sectionKey = formData.get("section_key")?.toString() as ConfigSectionKey;
  const configJson = formData.get("config_json")?.toString() ?? "{}";
  let configData: Record<string, unknown> = {};
  try {
    configData = JSON.parse(configJson);
  } catch {
    return;
  }

  await saveConfigSection(supabase, {
    organizationId: orgId,
    sectionKey,
    configData,
    userId: ctx.effectiveUserId,
    requiresApproval: formData.get("requires_approval") === "true",
    changeSummary: formData.get("change_summary")?.toString(),
  });

  revalidatePath("/dashboard/admin/configuration");
}

export async function saveConfigFieldsAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManageConfiguration(ctx)) return;

  const sectionKey = formData.get("section_key")?.toString() as ConfigSectionKey;
  const { getConfigSection } = await import("@/lib/configuration/sections");
  const existing = await getConfigSection(supabase, orgId, sectionKey);

  const configData: Record<string, unknown> = { ...existing };
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("field_")) configData[key.replace("field_", "")] = value;
  }

  await saveConfigSection(supabase, {
    organizationId: orgId,
    sectionKey,
    configData,
    userId: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/admin");
}

export async function toggleModuleAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManageConfiguration(ctx)) return;

  const moduleKey = formData.get("module_key")?.toString() ?? "";
  const action = formData.get("action")?.toString();

  if (action === "enable") await installModule(supabase, orgId, moduleKey, ctx.effectiveUserId);
  else await disableModule(supabase, orgId, moduleKey, ctx.effectiveUserId);

  revalidatePath("/dashboard/admin/modules");
}

export async function advanceSetupAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManageConfiguration(ctx)) return;

  let session = await startSetupSession(supabase, orgId, ctx.effectiveUserId);
  if (!session) return;

  const step = (formData.get("step")?.toString() ?? "organization") as SetupStepKey;
  const stepData: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("field_")) stepData[key.replace("field_", "")] = value;
  }

  await advanceSetupStep(supabase, {
    sessionId: session.id,
    organizationId: orgId,
    currentStep: step,
    stepData,
    userId: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/admin/setup");
}

export async function launchOrganizationAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canLaunchOrganization(ctx)) return;

  await launchOrganization(supabase, orgId, ctx.effectiveUserId);
  revalidatePath("/dashboard/admin/go-live");
}

export async function importConfigPackageAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManageConfiguration(ctx)) return;

  const content = formData.get("package_json")?.toString() ?? "";
  const parsed = parseConfigurationJson(content);
  if (!parsed) return;

  await importConfigurationPackage(supabase, orgId, parsed as Parameters<typeof importConfigurationPackage>[2], ctx.effectiveUserId);
  revalidatePath("/dashboard/admin/configuration");
}

export async function rollbackConfigAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canManageConfiguration(ctx)) return;

  const versionId = formData.get("version_id")?.toString() ?? "";
  await rollbackConfigVersion(supabase, versionId, ctx.effectiveUserId);
  revalidatePath("/dashboard/admin/configuration");
}
