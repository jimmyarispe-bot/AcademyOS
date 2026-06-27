import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-network/context";
import { getNetworkHubSummary } from "@/lib/intelligence-network/hub";
import { getBenchmarks, getEnterpriseDashboard } from "@/lib/intelligence-network/benchmark-engine";
import { identifyLeaders } from "@/lib/intelligence-network/executive-intelligence";
import { AinShell } from "@/components/intelligence-network/AinNav";
import { NetworkSummaryPanel, BenchmarkTable, RefreshNetworkButton, PrivacyNotice, AiReadinessNote } from "@/components/intelligence-network/AinPanels";
import { PEER_SEGMENTS } from "@/lib/intelligence-network/types";

export default async function NetworkBenchmarksPage() {
  await requirePagePermission(["network.view", "network.manage", "network.admin", "executive.intelligence"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const [summary, dashboard, benchmarks, leaders] = await Promise.all([
    getNetworkHubSummary(supabase, orgId),
    getEnterpriseDashboard(supabase),
    getBenchmarks(supabase, {}),
    identifyLeaders(supabase),
  ]);

  return (
    <AinShell title="Enterprise Intelligence Dashboard" subtitle="National and regional benchmarks, peer comparisons, growth and operational rankings">
      <PrivacyNotice />
      <RefreshNetworkButton />
      <NetworkSummaryPanel summary={summary} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        {[
          ["National Benchmarks", dashboard.nationalBenchmarks], ["Regional", dashboard.regionalBenchmarks],
          ["Peer Segments", dashboard.peerSegments], ["Categories", dashboard.categories],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl border bg-white p-4"><p className="text-slate-500">{String(l)}</p><p className="text-xl font-bold">{String(v)}</p></div>
        ))}
      </div>
      <p className="text-sm text-slate-600">Compare against: {PEER_SEGMENTS.map((s) => s.label).join(", ")}</p>
      <BenchmarkTable rows={benchmarks} />
      <section className="rounded-xl border bg-indigo-50 p-4 text-sm">
        <h2 className="font-semibold text-indigo-900">Executive Intelligence — anonymized leaders</h2>
        <ul className="mt-2 list-disc pl-5 text-indigo-800">
          {Object.entries(leaders).filter(([, v]) => v).map(([k]) => <li key={k}>{k.replace(/([A-Z])/g, " $1")}</li>)}
        </ul>
      </section>
      <AiReadinessNote />
    </AinShell>
  );
}
