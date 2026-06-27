import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getMappingProfiles(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_mapping_profiles")
    .select("*")
    .eq("organization_id", organizationId)
    .order("profile_name");
  return data ?? [];
}

export async function createMappingProfile(
  supabase: AuthClient,
  input: {
    organizationId: string;
    profileName: string;
    sourceEntity: string;
    targetEntity: string;
    connectorKey?: string;
    fieldMappings?: unknown[];
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("ihub_mapping_profiles")
    .insert({
      organization_id: input.organizationId,
      profile_name: input.profileName,
      connector_key: input.connectorKey ?? null,
      source_entity: input.sourceEntity,
      target_entity: input.targetEntity,
      field_mappings: input.fieldMappings ?? [],
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { profileId: data.id };
}

export async function previewMapping(input: {
  fieldMappings: Array<{ sourceField: string; targetField: string; defaultValue?: string }>;
  sampleRow: Record<string, unknown>;
}) {
  const mapped: Record<string, unknown> = {};
  for (const m of input.fieldMappings) {
    mapped[m.targetField] = input.sampleRow[m.sourceField] ?? m.defaultValue ?? null;
  }
  return { mapped, valid: Object.keys(mapped).length > 0 };
}
