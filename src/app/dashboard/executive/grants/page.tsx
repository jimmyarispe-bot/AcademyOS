import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getGrantsDashboard } from "@/lib/executive/insights";
import { getSchools } from "@/lib/hr/queries";
import { GrantsDashboardPanel } from "@/components/executive/ExecutivePanels";

export default async function ExecutiveGrantsPage() {
  const ctx = await getIdentityContext();
  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0];

  const supabase = await createAuthClient();
  const [data, schools] = await Promise.all([
    getGrantsDashboard(supabase, schoolId),
    getSchools(),
  ]);

  return <GrantsDashboardPanel data={data} schools={schools} />;
}
