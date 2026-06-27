import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getComplianceCenter } from "@/lib/executive/insights";
import { getSchools } from "@/lib/hr/queries";
import { ComplianceCenterPanel } from "@/components/executive/ExecutivePanels";

export default async function ExecutiveCompliancePage() {
  const ctx = await getIdentityContext();
  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0];

  const supabase = await createAuthClient();
  const [items, schools] = await Promise.all([
    getComplianceCenter(supabase, schoolId),
    getSchools(),
  ]);

  return <ComplianceCenterPanel items={items} schools={schools} />;
}
