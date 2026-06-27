import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-network/context";
import { getOrgBenchmarkComparison } from "@/lib/intelligence-network/benchmark-engine";
import { AinShell } from "@/components/intelligence-network/AinNav";
import { BenchmarkTable, PrivacyNotice } from "@/components/intelligence-network/AinPanels";

export default async function NetworkStudentSuccessPage() {
  await requirePagePermission(["network.view", "network.manage", "network.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const benchmarks = (await getOrgBenchmarkComparison(supabase, orgId, "academic"))
    .filter((b) => ["student_success_score", "intervention_effectiveness", "retention", "attendance"].includes(String(b.metric_key)));

  return (
    <AinShell title="Student Success Benchmarks" subtitle="Intervention effectiveness, retention, attendance, and student success scores vs peers">
      <PrivacyNotice />
      <BenchmarkTable rows={benchmarks} />
    </AinShell>
  );
}
