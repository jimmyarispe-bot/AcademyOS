import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { getCostSummary } from "@/lib/intelligence-platform/token-tracking";
import { AipShell } from "@/components/intelligence-platform/AipNav";
import { CostPanel } from "@/components/intelligence-platform/AipPanels";

export default async function CostsPage() {
  await requirePagePermission(["ai.view", "ai.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const costs = orgId ? await getCostSummary(supabase, orgId) : null;

  return (
    <AipShell title="Cost Center" subtitle="Daily, monthly, organization, school, and module usage with top prompts">
      {costs && (
        <>
          <CostPanel costs={costs} />
          <section>
            <h2 className="mb-3 font-semibold">Module breakdown</h2>
            <ul className="space-y-2 text-sm">
              {costs.moduleBreakdown.map((m) => (
                <li key={m.module} className="flex justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <span className="font-medium">{m.module}</span>
                  <span>${m.cost.toFixed(4)} — {m.tokens} tokens</span>
                </li>
              ))}
              {!costs.moduleBreakdown.length && <li className="text-slate-500">No usage recorded yet.</li>}
            </ul>
          </section>
        </>
      )}
    </AipShell>
  );
}
