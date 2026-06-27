import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-network/context";
import { getOrgBenchmarkComparison } from "@/lib/intelligence-network/benchmark-engine";
import { AinShell } from "@/components/intelligence-network/AinNav";
import { BenchmarkTable, PrivacyNotice } from "@/components/intelligence-network/AinPanels";

export default async function NetworkCompliancePage() {
  await requirePagePermission(["network.view", "network.manage", "network.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const benchmarks = await getOrgBenchmarkComparison(supabase, orgId, "compliance");

  return (
    <AinShell title="Compliance Benchmarks" subtitle="Anonymized compliance scores and audit readiness vs peer organizations">
      <PrivacyNotice />
      <BenchmarkTable rows={benchmarks} />
    </AinShell>
  );
}
