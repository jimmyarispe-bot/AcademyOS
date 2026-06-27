import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getKpiCenter } from "@/lib/executive/kpi-center";
import { KpiCenterPanel } from "@/components/executive/ExecutivePanels";

export default async function ExecutiveKpisPage() {
  const ctx = await getIdentityContext();
  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0];

  const supabase = await createAuthClient();
  const kpis = await getKpiCenter(supabase, schoolId);

  return <KpiCenterPanel kpis={kpis} />;
}
