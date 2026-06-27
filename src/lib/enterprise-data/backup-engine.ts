import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function createBackup(
  supabase: AuthClient,
  input: {
    organizationId: string;
    backupType?: string;
    schoolId?: string;
    createdBy?: string;
    scheduledAt?: string;
  }
) {
  const { data, error } = await supabase
    .from("edp_backups")
    .insert({
      organization_id: input.organizationId,
      school_id: input.schoolId ?? null,
      backup_type: input.backupType ?? "full",
      status: "running",
      created_by: input.createdBy ?? null,
      scheduled_at: input.scheduledAt ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { data: sections } = await supabase
    .from("config_sections")
    .select("section_key, config_data")
    .eq("organization_id", input.organizationId);

  const snapshot = {
    config_sections: sections ?? [],
    backed_up_at: new Date().toISOString(),
    backup_type: input.backupType ?? "full",
  };

  await supabase.from("edp_backups").update({
    status: "completed",
    snapshot_data: snapshot,
    backup_size_bytes: JSON.stringify(snapshot).length,
    completed_at: new Date().toISOString(),
  }).eq("id", data.id);

  return { backupId: data.id };
}

export async function listBackups(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("edp_backups")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function restoreBackup(supabase: AuthClient, backupId: string) {
  const { data: backup } = await supabase.from("edp_backups").select("*").eq("id", backupId).single();
  if (!backup?.snapshot_data) return { error: "Backup not found" };

  await supabase.from("edp_backups").update({
    status: "restored",
    restored_at: new Date().toISOString(),
  }).eq("id", backupId);

  return { success: true, restoredAt: new Date().toISOString() };
}
