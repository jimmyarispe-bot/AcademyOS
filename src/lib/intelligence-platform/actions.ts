"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import {
  canManageAi, canManageProviders, canManagePrompts, canTestAi, canAdminAi,
} from "@/lib/intelligence-platform/access";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { createPrompt, createPromptVersion, updatePromptStatus, rollbackPrompt } from "@/lib/intelligence-platform/prompt-registry";
import { createProviderInstance } from "@/lib/intelligence-platform/provider-abstraction";
import { createPolicy, registerKnowledgeSource } from "@/lib/intelligence-platform/policies-knowledge";
import { queueJob, cancelJob } from "@/lib/intelligence-platform/queue-engine";
import { requestApproval, reviewApproval } from "@/lib/intelligence-platform/approvals-audit";
import { runPromptTest } from "@/lib/intelligence-platform/testing-lab";
import { saveOrgSettings, saveSchoolSettings, saveModuleSettings } from "@/lib/intelligence-platform/settings";
import { syncIntelligencePlatform } from "@/lib/intelligence-platform/automation";
import type { AipPromptCategory } from "@/lib/intelligence-platform/types";

async function resolveOrg(formOrgId?: string | null) {
  const ctx = await getIdentityContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createAuthClient();
  const orgId = formOrgId || (await getPrimaryOrganizationId(supabase));
  if (!orgId) throw new Error("Organization not found");
  return { ctx, supabase, orgId };
}

export async function createPromptAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg(formData.get("organization_id")?.toString());
  if (!canManagePrompts(ctx)) return;

  await createPrompt(supabase, {
    organizationId: orgId,
    promptKey: formData.get("prompt_key")?.toString() ?? `prompt-${Date.now()}`,
    name: formData.get("name")?.toString() ?? "New Prompt",
    description: formData.get("description")?.toString(),
    category: (formData.get("category")?.toString() ?? "future") as AipPromptCategory,
    module: formData.get("module")?.toString() ?? "general",
    template: formData.get("template")?.toString() ?? "",
    ownerId: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/intelligence/prompts");
}

export async function createPromptVersionAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canManagePrompts(ctx)) return;

  await createPromptVersion(supabase, formData.get("prompt_id")?.toString() ?? "", {
    template: formData.get("template")?.toString() ?? "",
    changeSummary: formData.get("change_summary")?.toString(),
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/intelligence/prompts");
}

export async function publishPromptAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg();
  if (!canManagePrompts(ctx)) return;

  const promptId = formData.get("prompt_id")?.toString() ?? "";
  await updatePromptStatus(supabase, promptId, "published", ctx.effectiveUserId);
  await requestApproval(supabase, {
    organizationId: orgId,
    entityType: "prompt",
    entityId: promptId,
    approvalType: "human_review",
    requestedBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/intelligence/prompts");
  revalidatePath("/dashboard/intelligence/approvals");
}

export async function rollbackPromptAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canManagePrompts(ctx)) return;

  await rollbackPrompt(
    supabase,
    formData.get("prompt_id")?.toString() ?? "",
    Number(formData.get("version_number") ?? 1),
    ctx.effectiveUserId
  );

  revalidatePath("/dashboard/intelligence/prompts");
}

export async function createProviderAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg();
  if (!canManageProviders(ctx)) return;

  await createProviderInstance(supabase, {
    organizationId: orgId,
    providerKey: formData.get("provider_key")?.toString() ?? "",
    instanceName: formData.get("instance_name")?.toString() ?? "Primary",
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/intelligence/providers");
}

export async function createPolicyAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg();
  if (!canManageAi(ctx)) return;

  await createPolicy(supabase, {
    organizationId: orgId,
    policyKey: formData.get("policy_key")?.toString() ?? `policy-${Date.now()}`,
    policyName: formData.get("policy_name")?.toString() ?? "Policy",
    policyType: formData.get("policy_type")?.toString(),
    description: formData.get("description")?.toString(),
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/intelligence/policies");
}

export async function registerKnowledgeAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg();
  if (!canManageAi(ctx)) return;

  await registerKnowledgeSource(supabase, {
    organizationId: orgId,
    sourceKey: formData.get("source_key")?.toString() ?? `source-${Date.now()}`,
    sourceName: formData.get("source_name")?.toString() ?? "Source",
    sourceType: formData.get("source_type")?.toString() ?? "policy",
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/intelligence/policies");
}

export async function queueJobAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg();
  if (!canManageAi(ctx)) return;

  await queueJob(supabase, {
    organizationId: orgId,
    module: formData.get("module")?.toString() ?? "general",
    promptId: formData.get("prompt_id")?.toString(),
    requestedBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/intelligence/jobs");
}

export async function cancelJobAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canManageAi(ctx)) return;

  await cancelJob(supabase, formData.get("job_id")?.toString() ?? "");
  revalidatePath("/dashboard/intelligence/jobs");
}

export async function reviewApprovalAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canManageAi(ctx)) return;

  await reviewApproval(supabase, formData.get("approval_id")?.toString() ?? "", {
    status: (formData.get("status")?.toString() ?? "approved") as "approved" | "rejected" | "published",
    reviewedBy: ctx.effectiveUserId,
    notes: formData.get("notes")?.toString(),
  });

  revalidatePath("/dashboard/intelligence/approvals");
}

export async function runTestAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg();
  if (!canTestAi(ctx)) return;

  await runPromptTest(supabase, {
    organizationId: orgId,
    promptId: formData.get("prompt_id")?.toString(),
    providerKey: formData.get("provider_key")?.toString(),
    testInput: JSON.parse(formData.get("test_input")?.toString() ?? "{}"),
    runBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/intelligence/testing");
  revalidatePath("/dashboard/intelligence/history");
}

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg();
  if (!canAdminAi(ctx)) return;

  await saveOrgSettings(supabase, orgId, {
    aiEnabled: formData.get("ai_enabled") === "true",
    defaultProviderKey: formData.get("default_provider_key")?.toString(),
    requireHumanReview: formData.get("require_human_review") === "true",
    ferpaMaskingEnabled: formData.get("ferpa_masking_enabled") === "true",
    updatedBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/intelligence/settings");
}

export async function saveModuleSettingsAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveOrg();
  if (!canAdminAi(ctx)) return;

  await saveModuleSettings(supabase, {
    organizationId: orgId,
    moduleKey: formData.get("module_key")?.toString() ?? "general",
    aiEnabled: formData.get("ai_enabled") === "true",
    updatedBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/intelligence/settings");
}

export async function refreshAipAction(): Promise<void> {
  const { ctx, supabase } = await resolveOrg();
  if (!canManageAi(ctx)) return;

  await syncIntelligencePlatform(supabase);
  revalidatePath("/dashboard/intelligence");
}
