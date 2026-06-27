import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewEdi } from "@/lib/edi/access";
import { getLatestCapacitySnapshot } from "@/lib/edi/capacity-planning";
import { CapacityPanel } from "@/components/edi/EdiPanels";

export default async function ExecutiveCapacityPage() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewEdi(ctx)) return null;

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    "";

  if (!schoolId) return null;

  const supabase = await createAuthClient();
  const capacity = await getLatestCapacitySnapshot(supabase, schoolId);

  const shortages = capacity.projectedShortages;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Capacity planning — seats, teacher utilization, rooms, schedule, campus, and projected shortages.
      </p>
      <CapacityPanel capacity={capacity} />
      {shortages && Object.keys(shortages).length > 0 && (
        <article className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm">
          <h3 className="font-semibold text-amber-900">Projected shortages</h3>
          <ul className="mt-2 space-y-1 text-amber-800">
            {Object.entries(shortages).map(([k, v]) => (
              <li key={k}>{k.replace(/_/g, " ")}: {String(v ?? "—")}</li>
            ))}
          </ul>
        </article>
      )}
    </div>
  );
}
