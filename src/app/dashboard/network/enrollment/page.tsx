import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-network/context";
import { getOrgBenchmarkComparison } from "@/lib/intelligence-network/benchmark-engine";
import { AinShell } from "@/components/intelligence-network/AinNav";
import { BenchmarkTable, PrivacyNotice } from "@/components/intelligence-network/AinPanels";
import { ENROLLMENT_METRICS } from "@/lib/intelligence-network/types";

export default async function NetworkEnrollmentPage() {
  await requirePagePermission(["network.view", "network.manage", "network.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const benchmarks = await getOrgBenchmarkComparison(supabase, orgId, "enrollment");

  return (
    <AinShell title="Enrollment Benchmarks" subtitle="Lead conversion, acceptance, yield, retention, attrition, marketing ROI, enrollment growth">
      <PrivacyNotice />
      <p className="text-sm text-slate-600">Metrics: {ENROLLMENT_METRICS.join(", ")}</p>
      <BenchmarkTable rows={benchmarks} />
    </AinShell>
  );
}
