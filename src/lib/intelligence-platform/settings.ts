import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getOrgSettings(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase.from("aip_org_settings").select("*").eq("organization_id", organizationId).maybeSingle();
  return data;
}

export async function saveOrgSettings(
  supabase: AuthClient,
  organizationId: string,
  input: {
    aiEnabled?: boolean;
    defaultProviderKey?: string;
    maxTokensPerRequest?: number;
    maxMonthlyCostUsd?: number;
    requireHumanReview?: boolean;
    ferpaMaskingEnabled?: boolean;
    settings?: Record<string, unknown>;
    updatedBy?: string;
  }
) {
  await supabase.from("aip_org_settings").upsert({
    organization_id: organizationId,
    ai_enabled: input.aiEnabled ?? false,
    default_provider_key: input.defaultProviderKey ?? null,
    max_tokens_per_request: input.maxTokensPerRequest ?? 4096,
    max_monthly_cost_usd: input.maxMonthlyCostUsd ?? null,
    require_human_review: input.requireHumanReview ?? true,
    ferpa_masking_enabled: input.ferpaMaskingEnabled ?? true,
    settings: input.settings ?? {},
    updated_by: input.updatedBy ?? null,
  });
}

export async function getSchoolSettings(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase.from("aip_school_settings").select("*").eq("organization_id", organizationId);
  return data ?? [];
}

export async function saveSchoolSettings(
  supabase: AuthClient,
  input: {
    organizationId: string;
    schoolId: string;
    aiEnabled?: boolean;
    allowedModules?: string[];
    settings?: Record<string, unknown>;
    updatedBy?: string;
  }
) {
  await supabase.from("aip_school_settings").upsert({
    organization_id: input.organizationId,
    school_id: input.schoolId,
    ai_enabled: input.aiEnabled ?? false,
    allowed_modules: input.allowedModules ?? [],
    settings: input.settings ?? {},
    updated_by: input.updatedBy ?? null,
  }, { onConflict: "organization_id,school_id" });
}

export async function getModuleSettings(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase.from("aip_module_settings").select("*").eq("organization_id", organizationId);
  return data ?? [];
}

export async function saveModuleSettings(
  supabase: AuthClient,
  input: {
    organizationId: string;
    schoolId?: string;
    moduleKey: string;
    aiEnabled?: boolean;
    allowedCategories?: string[];
    settings?: Record<string, unknown>;
    updatedBy?: string;
  }
) {
  await supabase.from("aip_module_settings").upsert({
    organization_id: input.organizationId,
    school_id: input.schoolId ?? null,
    module_key: input.moduleKey,
    ai_enabled: input.aiEnabled ?? false,
    allowed_categories: input.allowedCategories ?? [],
    settings: input.settings ?? {},
    updated_by: input.updatedBy ?? null,
  }, { onConflict: "organization_id,school_id,module_key" });
}
