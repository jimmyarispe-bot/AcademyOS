import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/integration-hub/context";
import { getBackups, getRecoveryDrills } from "@/lib/integration-hub/disaster-recovery";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";
import { createBackupAction, runRecoveryDrillAction } from "@/lib/integration-hub/actions";

export default async function DisasterRecoveryPage() {
  await requirePagePermission(["integration.admin", "integration.security"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [backups, drills] = await Promise.all([
    orgId ? getBackups(supabase, orgId) : [],
    orgId ? getRecoveryDrills(supabase, orgId) : [],
  ]);

  return (
    <IntHubShell title="Disaster Recovery Center" subtitle="Full tenant backup, point-in-time recovery, sandbox restore, clone organization, regional replication, recovery drills">
      <div className="flex flex-wrap gap-3">
        <form action={createBackupAction}><button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Full tenant backup</button></form>
        <form action={runRecoveryDrillAction}><button type="submit" className="rounded-lg border px-4 py-2 text-sm">Run recovery drill</button></form>
      </div>
      <section>
        <h2 className="mb-2 font-semibold">Backups</h2>
        <IntHubTable rows={backups} columns={[
          { key: "backup_type", label: "Type" }, { key: "status", label: "Status" },
          { key: "storage_path", label: "Path" }, { key: "verified_at", label: "Verified" }, { key: "created_at", label: "Created" },
        ]} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Recovery Drills</h2>
        <IntHubTable rows={drills} columns={[
          { key: "drill_type", label: "Drill" }, { key: "status", label: "Status" },
          { key: "completed_at", label: "Completed" }, { key: "created_at", label: "Scheduled" },
        ]} />
      </section>
    </IntHubShell>
  );
}
