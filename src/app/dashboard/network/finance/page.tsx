import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-network/context";
import { getOrgBenchmarkComparison } from "@/lib/intelligence-network/benchmark-engine";
import { AinShell } from "@/components/intelligence-network/AinNav";
import { BenchmarkTable, PrivacyNotice } from "@/components/intelligence-network/AinPanels";
import { FINANCIAL_METRICS } from "@/lib/intelligence-network/types";

export default async function NetworkFinancePage() {
  await requirePagePermission(["network.view", "network.manage", "network.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const benchmarks = await getOrgBenchmarkComparison(supabase, orgId, "financial");

  return (
    <AinShell title="Financial Benchmarks" subtitle="Revenue per student, EBITDA, operating margin, payroll, scholarships, state funding, collection rates, cash flow">
      <PrivacyNotice />
      <p className="text-sm text-slate-600">Metrics: {FINANCIAL_METRICS.join(", ")}</p>
      <BenchmarkTable rows={benchmarks} />
    </AinShell>
  );
}
