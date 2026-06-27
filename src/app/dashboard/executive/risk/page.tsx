import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getRiskRegister, syncDetectedRisksToRegister } from "@/lib/executive/risk-intelligence";
import { RiskIntelligencePanel } from "@/components/executive/ExecutivePanels";

export default async function ExecutiveRiskPage() {
  const ctx = await getIdentityContext();
  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0];

  const supabase = await createAuthClient();
  await syncDetectedRisksToRegister(supabase, schoolId);
  const risks = await getRiskRegister(supabase, schoolId);

  return <RiskIntelligencePanel risks={risks} />;
}
