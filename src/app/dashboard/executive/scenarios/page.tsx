import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewEdi } from "@/lib/edi/access";
import { compareScenarios, runScenarioComparisonSet } from "@/lib/edi/scenario-comparison";
import { ScenarioComparisonTable, ScenarioForm } from "@/components/edi/EdiPanels";

export default async function ExecutiveScenariosPage() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewEdi(ctx)) return null;

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    "";

  if (!schoolId) return null;

  const supabase = await createAuthClient();
  let scenarios = await compareScenarios(supabase, schoolId);

  if (!scenarios.length) {
    await runScenarioComparisonSet(supabase, schoolId, ctx.effectiveUserId);
    scenarios = await compareScenarios(supabase, schoolId);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Compare tuition, staffing, enrollment, and capacity scenarios with projected financial and operational outcomes.
      </p>
      <ScenarioComparisonTable scenarios={scenarios} />
      <ScenarioForm schoolId={schoolId} />
    </div>
  );
}
