import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function createArchive(
  supabase: AuthClient,
  input: {
    organizationId: string;
    archiveType: string;
    entityType?: string;
    entityId?: string;
    retentionPolicy?: string;
    archivedData?: Record<string, unknown>;
    archivedBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("edp_archives")
    .insert({
      organization_id: input.organizationId,
      archive_type: input.archiveType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      retention_policy: input.retentionPolicy ?? "7_years",
      archived_data: input.archivedData ?? {},
      archived_by: input.archivedBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { archiveId: data.id };
}

export async function listArchives(supabase: AuthClient, organizationId: string, archiveType?: string) {
  let query = supabase.from("edp_archives").select("*").eq("organization_id", organizationId).order("archived_at", { ascending: false });
  if (archiveType) query = query.eq("archive_type", archiveType);
  const { data } = await query.limit(50);
  return data ?? [];
}

export async function archiveSchoolYear(
  supabase: AuthClient,
  organizationId: string,
  schoolYear: string,
  archivedBy?: string
) {
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, lifecycle_stage, grade_level")
    .eq("lifecycle_stage", "graduated")
    .limit(500);

  return createArchive(supabase, {
    organizationId,
    archiveType: "school_year",
    retentionPolicy: "permanent",
    archivedData: { schoolYear, graduates: students ?? [] },
    archivedBy,
  });
}
