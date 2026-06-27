import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ConfigSectionKey } from "@/lib/configuration/types";
import { SECTION_DEFAULTS } from "@/lib/configuration/types";
import { recordConfigVersion } from "@/lib/configuration/versioning";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getConfigSection(
  supabase: AuthClient,
  organizationId: string,
  sectionKey: ConfigSectionKey,
  schoolId?: string | null
): Promise<Record<string, unknown>> {
  let query = supabase
    .from("config_sections")
    .select("config_data")
    .eq("organization_id", organizationId)
    .eq("section_key", sectionKey);

  if (schoolId) query = query.eq("school_id", schoolId);
  else query = query.is("school_id", null);

  const { data } = await query.maybeSingle();
  const defaults = SECTION_DEFAULTS[sectionKey] ?? {};
  return { ...defaults, ...((data?.config_data as Record<string, unknown>) ?? {}) };
}

export async function saveConfigSection(
  supabase: AuthClient,
  input: {
    organizationId: string;
    sectionKey: ConfigSectionKey;
    configData: Record<string, unknown>;
    schoolId?: string | null;
    userId?: string;
    requiresApproval?: boolean;
    changeSummary?: string;
  }
) {
  const previous = await getConfigSection(supabase, input.organizationId, input.sectionKey, input.schoolId);

  const row = {
    organization_id: input.organizationId,
    school_id: input.schoolId ?? null,
    section_key: input.sectionKey,
    config_data: input.configData,
    updated_by: input.userId ?? null,
    requires_approval: input.requiresApproval ?? false,
    approval_status: input.requiresApproval ? "pending_approval" : "approved",
  };

  const { data, error } = await supabase
    .from("config_sections")
    .upsert(row, { onConflict: "organization_id,school_id,section_key" })
    .select("id, schema_version")
    .single();

  if (error) return { error: error.message };

  await recordConfigVersion(supabase, {
    organizationId: input.organizationId,
    schoolId: input.schoolId,
    sectionKey: input.sectionKey,
    configSectionId: data.id,
    previousValues: previous,
    newValues: input.configData,
    changedBy: input.userId,
    changeSummary: input.changeSummary ?? `Updated ${input.sectionKey} configuration`,
    versionNumber: (data.schema_version ?? 0) + 1,
  });

  await supabase
    .from("config_sections")
    .update({ schema_version: (data.schema_version ?? 0) + 1 })
    .eq("id", data.id);

  return { success: true };
}

export async function listConfigSections(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("config_sections")
    .select("section_key, school_id, updated_at, approval_status")
    .eq("organization_id", organizationId)
    .order("section_key");

  return data ?? [];
}
