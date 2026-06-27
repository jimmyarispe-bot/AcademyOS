import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getNetworkDashboardBySchool, getNetworkDashboardByCampus, getNetworkDashboardByProgram } from "@/lib/executive/network-dashboard";
import { NetworkDashboardPanel } from "@/components/executive/ExecutivePanels";

export default async function ExecutiveNetworkPage() {
  const ctx = await getIdentityContext();
  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0] ||
    "";

  const supabase = await createAuthClient();
  const [bySchool, byCampus, byProgram] = await Promise.all([
    getNetworkDashboardBySchool(supabase),
    schoolId ? getNetworkDashboardByCampus(supabase, schoolId) : Promise.resolve([]),
    getNetworkDashboardByProgram(supabase, schoolId || undefined),
  ]);

  return (
    <div className="space-y-6">
      <NetworkDashboardPanel rows={bySchool} title="Network — by school" />
      {byCampus.length > 0 && <NetworkDashboardPanel rows={byCampus} title="Drill-down — by campus" />}
      <NetworkDashboardPanel rows={byProgram} title="Drill-down — by program" />
    </div>
  );
}
