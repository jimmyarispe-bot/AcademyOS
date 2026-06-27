import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { NetworkHubSummary } from "@/lib/intelligence-network/types";
import { getPrimaryOrganizationId } from "@/lib/intelligence-network/context";
import { getParticipationSettings } from "@/lib/intelligence-network/participation";
import { contributeAnonymizedMetrics, aggregateNetworkBenchmarks } from "@/lib/intelligence-network/aggregation";
import { generateForecasts } from "@/lib/intelligence-network/forecast-engine";
import { generateRecommendations } from "@/lib/intelligence-network/recommendation-engine";
import { generateExecutiveRankings } from "@/lib/intelligence-network/executive-intelligence";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getNetworkHubSummary(supabase: AuthClient, organizationId: string): Promise<NetworkHubSummary> {
  const [settings, benchmarks, recommendations, research] = await Promise.all([
    getParticipationSettings(supabase, organizationId),
    supabase.from("ain_benchmark_snapshots").select("id", { count: "exact", head: true }),
    supabase.from("ain_recommendations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
    supabase.from("ain_research_reports").select("id", { count: "exact", head: true }),
  ]);

  const { count: peers } = await supabase.from("ain_contributions").select("organization_id", { count: "exact", head: true });

  return {
    participationStatus: (settings?.participation_status as NetworkHubSummary["participationStatus"]) ?? "opt_out",
    peerCount: peers ?? 0,
    benchmarkCount: benchmarks.count ?? 0,
    recommendationCount: recommendations.count ?? 0,
    researchReportCount: research.count ?? 0,
  };
}

export async function syncIntelligenceNetwork(supabase: AuthClient) {
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return;

  const settings = await getParticipationSettings(supabase, orgId);
  if (!settings) {
    await supabase.from("ain_participation_settings").insert({
      organization_id: orgId,
      participation_status: "opt_out",
    });
    return;
  }

  if (settings.participation_status !== "opt_out") {
    await contributeAnonymizedMetrics(supabase, orgId);
    await aggregateNetworkBenchmarks(supabase);
    await generateForecasts(supabase, orgId);
    await generateRecommendations(supabase, orgId);
    await generateExecutiveRankings(supabase);
  }
}
