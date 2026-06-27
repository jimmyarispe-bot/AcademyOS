import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getSupportTickets, getLatestSupportSnapshot } from "@/lib/operations-platform/support";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsMetricsGrid, OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsSupportPage() {
  await requireOperationsPermission(["operations.support"]);
  const supabase = await createAuthClient();
  const [snapshot, tickets] = await Promise.all([getLatestSupportSnapshot(supabase), getSupportTickets(supabase)]);

  return (
    <OpsShell title="Support Operations" subtitle="Tickets, escalations, SLA, response time, resolution time, CSAT, knowledge articles">
      {snapshot && (
        <OpsMetricsGrid metrics={[
          ["Open Tickets", snapshot.open_tickets], ["Escalations", snapshot.escalations],
          ["SLA Breaches", snapshot.sla_breaches], ["Avg Response", `${snapshot.avg_response_minutes}m`],
          ["Avg Resolution", `${snapshot.avg_resolution_hours}h`], ["CSAT", `${snapshot.customer_satisfaction}%`],
          ["Support Load", `${snapshot.support_load_pct}%`], ["Knowledge Articles", snapshot.knowledge_articles],
        ]} />
      )}
      <OpsTable rows={tickets} columns={[
        { key: "subject", label: "Subject" }, { key: "status", label: "Status" },
        { key: "priority", label: "Priority" }, { key: "created_at", label: "Created" },
      ]} />
    </OpsShell>
  );
}
