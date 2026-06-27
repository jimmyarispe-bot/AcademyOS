import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getIncidents } from "@/lib/cloud-platform/incidents";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsIncidentsPage() {
  await requireOperationsPermission(["operations.view", "operations.manage"]);
  const supabase = await createAuthClient();
  const incidents = await getIncidents(supabase);

  return (
    <OpsShell title="Incident Management" subtitle="Platform incidents, root cause analysis, and resolution tracking">
      <OpsTable rows={incidents} columns={[
        { key: "title", label: "Incident" }, { key: "severity", label: "Severity" },
        { key: "status", label: "Status" }, { key: "started_at", label: "Started" },
        { key: "resolved_at", label: "Resolved" },
      ]} />
    </OpsShell>
  );
}
