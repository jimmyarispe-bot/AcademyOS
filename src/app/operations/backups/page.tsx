import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getBackupRecords } from "@/lib/operations-platform/backups";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";
import { createBackupAction } from "@/lib/operations-platform/actions";

export default async function OperationsBackupsPage() {
  await requireOperationsPermission(["operations.manage", "operations.security"]);
  const supabase = await createAuthClient();
  const backups = await getBackupRecords(supabase);

  return (
    <OpsShell title="Backup Operations" subtitle="Full tenant backup, verification, and backup status across organizations">
      <form action={createBackupAction}><button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Run backup verification</button></form>
      <OpsTable rows={backups} columns={[
        { key: "backup_type", label: "Type" }, { key: "status", label: "Status" },
        { key: "verified_at", label: "Verified" }, { key: "created_at", label: "Created" },
      ]} />
    </OpsShell>
  );
}
