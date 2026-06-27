import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-network/context";
import { getRecommendations } from "@/lib/intelligence-network/recommendation-engine";
import { AinShell } from "@/components/intelligence-network/AinNav";
import { PrivacyNotice } from "@/components/intelligence-network/AinPanels";
import { dismissRecommendationAction } from "@/lib/intelligence-network/actions";

export default async function NetworkRecommendationsPage() {
  await requirePagePermission(["network.view", "network.manage", "network.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const recommendations = await getRecommendations(supabase, orgId);

  return (
    <AinShell title="Recommendation Engine" subtitle="Rules-based recommendations from anonymized peer benchmarks — no AI">
      <PrivacyNotice />
      <div className="space-y-3">
        {recommendations.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-slate-600">{r.description}</p>
                <p className="mt-1 text-xs text-slate-400">Rule: {r.rule_basis} · {r.priority}</p>
              </div>
              <form action={dismissRecommendationAction}>
                <input type="hidden" name="recommendation_id" value={r.id} />
                <button type="submit" className="rounded bg-slate-100 px-3 py-1 text-xs">Dismiss</button>
              </form>
            </div>
          </div>
        ))}
      </div>
      {!recommendations.length && <p className="text-sm text-slate-500">No active recommendations. Sync network after opting in.</p>}
    </AinShell>
  );
}
