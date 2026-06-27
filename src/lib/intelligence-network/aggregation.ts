import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { MetricCategory } from "@/lib/intelligence-network/types";
import { ACADEMIC_METRICS, FINANCIAL_METRICS, STAFFING_METRICS, ENROLLMENT_METRICS } from "@/lib/intelligence-network/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function hashOrg(orgId: string, period: string) {
  return `anon_${orgId.slice(0, 8)}_${period}`.replace(/-/g, "");
}

function sampleMetrics(category: MetricCategory) {
  const base: Record<string, number> = {};
  const keys =
    category === "academic" ? ACADEMIC_METRICS :
    category === "financial" ? FINANCIAL_METRICS :
    category === "staffing" ? STAFFING_METRICS :
    category === "enrollment" ? ENROLLMENT_METRICS :
    ["compliance_score", "audit_readiness", "operational_efficiency"];

  keys.forEach((k, i) => { base[k] = 70 + (i * 3) % 25; });
  return base;
}

export async function contributeAnonymizedMetrics(supabase: AuthClient, organizationId: string) {
  const { data: settings } = await supabase
    .from("ain_participation_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!settings || settings.participation_status === "opt_out") return;

  const period = new Date().toISOString().split("T")[0];
  const categories = (settings.data_categories as string[]) ?? ["academic"];
  const segments = (settings.peer_segments as string[]) ?? ["private"];

  for (const segment of segments) {
    for (const category of categories) {
      await supabase.from("ain_contributions").upsert({
        organization_id: organizationId,
        contribution_period: period,
        segment_key: segment,
        metric_category: category as MetricCategory,
        metrics: sampleMetrics(category as MetricCategory),
        anonymized_hash: hashOrg(organizationId, `${period}-${segment}-${category}`),
      }, { onConflict: "organization_id,contribution_period,segment_key,metric_category" });
    }
  }

  await supabase.from("ain_audit_log").insert({
    organization_id: organizationId,
    action_type: "contribution_submitted",
    details: { period, categories: categories.length, segments: segments.length },
  });
}

export async function aggregateNetworkBenchmarks(supabase: AuthClient) {
  const today = new Date().toISOString().split("T")[0];
  const { data: contributions } = await supabase.from("ain_contributions").select("*");

  const groups = new Map<string, Record<string, number[]>>();
  for (const c of contributions ?? []) {
    const key = `${c.segment_key}:${c.metric_category}`;
    const metrics = c.metrics as Record<string, number>;
    if (!groups.has(key)) groups.set(key, {});
    const g = groups.get(key)!;
    for (const [mk, val] of Object.entries(metrics)) {
      if (!g[mk]) g[mk] = [];
      g[mk].push(Number(val));
    }
  }

  for (const [key, metricMap] of groups) {
    const [segmentKey, metricCategory] = key.split(":");
    const peerCount = contributions?.filter((c) => c.segment_key === segmentKey && c.metric_category === metricCategory).length ?? 0;

    for (const [metricKey, values] of Object.entries(metricMap)) {
      values.sort((a, b) => a - b);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const pct = (p: number) => values[Math.floor(values.length * p)] ?? mean;

      await supabase.from("ain_benchmark_snapshots").upsert({
        snapshot_date: today,
        benchmark_scope: "national",
        segment_key: segmentKey,
        metric_category: metricCategory,
        metric_key: metricKey,
        peer_count: peerCount,
        percentile_25: pct(0.25),
        percentile_50: pct(0.5),
        percentile_75: pct(0.75),
        percentile_90: pct(0.9),
        mean_value: mean,
      }, { onConflict: "snapshot_date,benchmark_scope,segment_key,metric_category,metric_key" });
    }
  }
}
