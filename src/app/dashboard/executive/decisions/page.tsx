import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewEdi } from "@/lib/edi/access";
import { getTopRecommendations } from "@/lib/edi/recommendation-engine";
import { getDecisionHistory } from "@/lib/edi/decision-history";
import { getLatestScorecard } from "@/lib/edi/scorecard";
import { DecisionCardList, ExecutiveScorecardPanel, RefreshEdiButton } from "@/components/edi/EdiPanels";

export default async function ExecutiveDecisionsPage() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewEdi(ctx)) return null;

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    "";

  if (!schoolId) return null;

  const supabase = await createAuthClient();
  const [recommendations, history, scorecard] = await Promise.all([
    getTopRecommendations(supabase, schoolId, 15),
    getDecisionHistory(supabase, schoolId, 20),
    getLatestScorecard(supabase, schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600">Decision workspace — approve, reject, and track outcomes</p>
        <RefreshEdiButton />
      </div>

      <ExecutiveScorecardPanel scorecard={scorecard} />
      <DecisionCardList cards={recommendations} schoolId={schoolId} />

      <section>
        <h2 className="mb-3 font-semibold">Decision history</h2>
        <ul className="space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex justify-between gap-2">
                <span className="font-medium capitalize">{String(h.decision_made)}</span>
                <span className="text-slate-500">{new Date(h.decided_at).toLocaleDateString()}</span>
              </div>
              {h.reason && <p className="mt-1 text-slate-600">{h.reason}</p>}
            </li>
          ))}
          {!history.length && <li className="text-slate-500">No decisions recorded yet.</li>}
        </ul>
      </section>
    </div>
  );
}
