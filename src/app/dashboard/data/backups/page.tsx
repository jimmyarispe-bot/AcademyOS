import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { listBackups } from "@/lib/enterprise-data/backup-engine";
import { EdpShell } from "@/components/enterprise-data/EdpNav";
import { HistoryTable } from "@/components/enterprise-data/EdpPanels";
import { createBackupAction, restoreBackupAction } from "@/lib/enterprise-data/actions";

export default async function DataBackupsPage() {
  await requirePagePermission(["data.export", "data.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const backups = orgId ? await listBackups(supabase, orgId) : [];

  return (
    <EdpShell title="Backup & Restore" subtitle="Full organization backups, school backups, configuration snapshots, and point-in-time restore">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={createBackupAction} className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            Backup type
            <select name="backup_type" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2">
              <option value="full">Full organization</option>
              <option value="school">School</option>
              <option value="configuration">Configuration</option>
              <option value="database_snapshot">Database snapshot</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create backup
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Backup history</h2>
        <HistoryTable
          rows={backups}
          columns={[
            { key: "backup_type", label: "Type" },
            { key: "status", label: "Status" },
            { key: "backup_size_bytes", label: "Size (bytes)" },
            { key: "created_at", label: "Created" },
          ]}
        />
        {backups.filter((b) => b.status === "completed").map((b) => (
          <form key={b.id} action={restoreBackupAction} className="mt-2 inline-block mr-2">
            <input type="hidden" name="backup_id" value={b.id} />
            <button type="submit" className="text-sm text-brand-600 hover:underline">
              Restore {String(b.backup_type)}
            </button>
          </form>
        ))}
      </section>
    </EdpShell>
  );
}
