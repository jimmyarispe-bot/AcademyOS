import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getLatestDrTests } from "@/lib/certification/dr-engine";
import { CertShell } from "@/components/certification/CertNav";
import { CertTable } from "@/components/certification/CertPanels";

export default async function CertificationDrPage() {
  await requirePagePermission(["certification.view", "certification.admin"]);
  const supabase = await createAuthClient();
  const tests = await getLatestDrTests(supabase);

  return (
    <CertShell title="Disaster Recovery" subtitle="Backups, restore, cloning, tenant recovery, configuration recovery, rollback">
      <CertTable rows={tests} columns={[{ key: "test_name", label: "Test" }, { key: "status", label: "Status" }]} />
    </CertShell>
  );
}
