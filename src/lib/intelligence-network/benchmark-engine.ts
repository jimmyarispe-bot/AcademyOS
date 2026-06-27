import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { MetricCategory } from "@/lib/intelligence-network/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getBenchmarks(
  supabase: AuthClient,
  query: { category?: MetricCategory; segmentKey?: string; scope?: string }
) {
  let q = supabase.from("ain_benchmark_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(100);
  if (query.category) q = q.eq("metric_category", query.category);
  if (query.segmentKey) q = q.eq("segment_key", query.segmentKey);
  if (query.scope) q = q.eq("benchmark_scope", query.scope);
  const { data } = await q;
  return data ?? [];
}

export async function getOrgBenchmarkComparison(
  supabase: AuthClient,
  organizationId: string,
  category: MetricCategory
) {
  const [benchmarks, contribution] = await Promise.all([
    getBenchmarks(supabase, { category }),
    supabase.from("ain_contributions").select("metrics, segment_key").eq("organization_id", organizationId).eq("metric_category", category).order("contribution_period", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const orgMetrics = (contribution.data?.metrics as Record<string, number>) ?? {};
  return benchmarks.map((b) => ({
    ...b,
    org_value: orgMetrics[b.metric_key] ?? null,
    vs_median: orgMetrics[b.metric_key] != null ? orgMetrics[b.metric_key] - Number(b.percentile_50) : null,
  }));
}

export async function getEnterpriseDashboard(supabase: AuthClient) {
  const { data } = await supabase
    .from("ain_benchmark_snapshots")
    .select("benchmark_scope, segment_key, metric_category")
    .order("snapshot_date", { ascending: false })
    .limit(200);

  const scopes = new Set((data ?? []).map((d) => d.benchmark_scope));
  const segments = new Set((data ?? []).map((d) => d.segment_key));
  return {
    nationalBenchmarks: [...scopes].filter((s) => s === "national").length,
    regionalBenchmarks: [...scopes].filter((s) => s === "regional").length,
    peerSegments: segments.size,
    categories: new Set((data ?? []).map((d) => d.metric_category)).size,
  };
}
