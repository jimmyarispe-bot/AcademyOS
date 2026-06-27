import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getDisasterRecoveryStatus } from "@/lib/operations-platform/backups";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsMetricsGrid } from "@/components/operations-platform/OpsPanels";

export default async function OperationsDisasterRecoveryPage() {
  await requireOperationsPermission(["operations.manage", "operations.security"]);
  const supabase = await createAuthClient();
  const status = await getDisasterRecoveryStatus(supabase);

  return (
    <OpsShell title="Disaster Recovery" subtitle="Point-in-time recovery, sandbox restore, clone organization, regional replication, recovery drills">
      <OpsMetricsGrid metrics={[
        ["Total Backups", status.totalBackups], ["Verified Backups", status.verifiedBackups],
        ["Recovery Drills Passed", status.recoveryDrillsPassed],
      ]} />
      <p className="text-sm text-slate-600">Integrates with Integration Platform DR center and Cloud Platform backup infrastructure.</p>
    </OpsShell>
  );
}
