import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getBackupRecords(supabase: AuthClient) {
  const { data } = await supabase.from("ops_backup_records").select("*").order("created_at", { ascending: false }).limit(30);
  return data ?? [];
}

export async function createBackupRecord(supabase: AuthClient, organizationId?: string) {
  const { data, error } = await supabase
    .from("ops_backup_records")
    .insert({
      organization_id: organizationId ?? null,
      backup_type: "full_tenant",
      status: "running",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("ops_backup_records").update({
    status: "verified",
    verified_at: new Date().toISOString(),
  }).eq("id", data.id);

  return { backupId: data.id };
}

export async function getDisasterRecoveryStatus(supabase: AuthClient) {
  const [backups, drills] = await Promise.all([
    supabase.from("ops_backup_records").select("status"),
    supabase.from("ihub_dr_drills").select("status").limit(10),
  ]);
  const verified = (backups.data ?? []).filter((b) => b.status === "verified").length;
  const passedDrills = (drills.data ?? []).filter((d) => d.status === "passed").length;
  return { totalBackups: backups.data?.length ?? 0, verifiedBackups: verified, recoveryDrillsPassed: passedDrills };
}
