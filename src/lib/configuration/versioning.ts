import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function recordConfigVersion(
  supabase: AuthClient,
  input: {
    organizationId: string;
    schoolId?: string | null;
    sectionKey: string;
    configSectionId?: string;
    previousValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
    changedBy?: string;
    changeSummary?: string;
    versionNumber: number;
    isRollback?: boolean;
  }
) {
  await supabase.from("config_version_history").insert({
    organization_id: input.organizationId,
    school_id: input.schoolId ?? null,
    section_key: input.sectionKey,
    config_section_id: input.configSectionId ?? null,
    version_number: input.versionNumber,
    previous_values: input.previousValues,
    new_values: input.newValues,
    change_summary: input.changeSummary ?? null,
    changed_by: input.changedBy ?? null,
    is_rollback: input.isRollback ?? false,
  });
}

export async function getConfigVersionHistory(
  supabase: AuthClient,
  organizationId: string,
  sectionKey?: string,
  limit = 20
) {
  let query = supabase
    .from("config_version_history")
    .select("*")
    .eq("organization_id", organizationId)
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (sectionKey) query = query.eq("section_key", sectionKey);
  const { data } = await query;
  return data ?? [];
}

export async function rollbackConfigVersion(
  supabase: AuthClient,
  versionId: string,
  userId?: string
) {
  const { data: version } = await supabase
    .from("config_version_history")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();

  if (!version) return { error: "Version not found" };

  const previous = version.previous_values as Record<string, unknown>;

  await supabase
    .from("config_sections")
    .update({
      config_data: previous,
      updated_by: userId ?? null,
      approval_status: "approved",
    })
    .eq("organization_id", version.organization_id)
    .eq("section_key", version.section_key);

  await recordConfigVersion(supabase, {
    organizationId: version.organization_id,
    schoolId: version.school_id,
    sectionKey: version.section_key,
    previousValues: version.new_values as Record<string, unknown>,
    newValues: previous,
    changedBy: userId,
    changeSummary: `Rollback to version ${version.version_number}`,
    versionNumber: version.version_number + 1,
    isRollback: true,
  });

  return { success: true };
}
