import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { getAuditLogs } from "@/lib/intelligence-platform/approvals-audit";
import { getUsageHistory } from "@/lib/intelligence-platform/token-tracking";
import { AipShell } from "@/components/intelligence-platform/AipNav";
import { HistoryTable } from "@/components/intelligence-platform/AipPanels";

export default async function HistoryPage() {
  await requirePagePermission(["ai.view", "ai.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [audit, usage] = orgId
    ? await Promise.all([getAuditLogs(supabase, orgId), getUsageHistory(supabase, orgId)])
    : [[], []];

  return (
    <AipShell title="AI Audit History" subtitle="Who requested, prompt version, context sources, provider, execution time, and approval">
      <section>
        <h2 className="mb-3 font-semibold">Audit logs</h2>
        <HistoryTable
          rows={audit}
          columns={[
            { key: "response_status", label: "Status" },
            { key: "provider_key", label: "Provider" },
            { key: "execution_time_ms", label: "Time (ms)" },
            { key: "created_at", label: "When" },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Token usage</h2>
        <HistoryTable
          rows={usage}
          columns={[
            { key: "module", label: "Module" },
            { key: "tokens_in", label: "Tokens in" },
            { key: "tokens_out", label: "Tokens out" },
            { key: "estimated_cost_usd", label: "Cost" },
            { key: "status", label: "Status" },
          ]}
        />
      </section>
    </AipShell>
  );
}
