import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getAuditLogs } from "@/lib/cloud-platform/audit";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";

export default async function CloudAuditPage() {
  await requireCloudPermission(["cloud.admin", "cloud.operations"]);
  const supabase = await createAuthClient();
  const logs = await getAuditLogs(supabase);

  return (
    <CloudShell title="Cloud Audit" subtitle="Provisioning, billing, support, deployments, licensing, and feature flags">
      <CloudTable rows={logs} columns={[
        { key: "action_type", label: "Action" }, { key: "entity_type", label: "Entity" },
        { key: "created_at", label: "When" },
      ]} />
    </CloudShell>
  );
}
