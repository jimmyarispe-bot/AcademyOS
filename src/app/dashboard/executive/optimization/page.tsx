import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewEdi } from "@/lib/edi/access";
import {
  getRecommendationsByDomain,
} from "@/lib/edi/recommendation-engine";
import { computeEducationalRoi } from "@/lib/edi/educational-roi";
import { DecisionCardList } from "@/components/edi/EdiPanels";

export default async function ExecutiveOptimizationPage() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewEdi(ctx)) return null;

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    "";

  if (!schoolId) return null;

  const supabase = await createAuthClient();
  const [financial, enrollment, scheduling, roi] = await Promise.all([
    getRecommendationsByDomain(supabase, schoolId, "financial"),
    getRecommendationsByDomain(supabase, schoolId, "enrollment"),
    getRecommendationsByDomain(supabase, schoolId, "scheduling"),
    computeEducationalRoi(supabase, schoolId),
  ]);

  const topRoi = roi.slice(0, 10);
  const bottomRoi = [...roi].reverse().slice(0, 5);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-semibold">Financial optimization</h2>
        <DecisionCardList cards={financial} schoolId={schoolId} />
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Enrollment optimization</h2>
        <DecisionCardList cards={enrollment} schoolId={schoolId} />
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Scheduling optimization</h2>
        <DecisionCardList cards={scheduling} schoolId={schoolId} />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">Highest educational ROI</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {topRoi.map((r) => (
              <li key={`${r.entityType}-${r.entityKey}`} className="flex justify-between">
                <span>{r.entityKey ?? r.entityType}</span>
                <span className="font-medium">{r.overallEducationalRoi.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">Lowest educational ROI</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {bottomRoi.map((r) => (
              <li key={`${r.entityType}-${r.entityKey}-low`} className="flex justify-between">
                <span>{r.entityKey ?? r.entityType}</span>
                <span className="font-medium text-rose-700">{r.overallEducationalRoi.toFixed(1)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Methodology: weighted composite of financial ROI, margin, enrollment, and instructional metrics from Financial Intelligence.
          </p>
        </article>
      </section>
    </div>
  );
}
