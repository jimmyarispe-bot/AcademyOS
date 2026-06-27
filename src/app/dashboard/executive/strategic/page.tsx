import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getStrategicPlanningWorkspace } from "@/lib/executive/insights";
import { getSchools } from "@/lib/hr/queries";
import { StrategicPlanningPanel } from "@/components/executive/ExecutivePanels";

export default async function ExecutiveStrategicPage() {
  const ctx = await getIdentityContext();
  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0];

  const supabase = await createAuthClient();
  const [goals, schools] = await Promise.all([
    getStrategicPlanningWorkspace(supabase, schoolId),
    getSchools(),
  ]);

  return <StrategicPlanningPanel goals={goals} schools={schools} />;
}
