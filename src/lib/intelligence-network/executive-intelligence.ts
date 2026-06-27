import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const RANKING_TYPES = [
  "top_performing", "fastest_growing", "academic_growth", "profitability", "operational_excellence", "compliance_leaders",
] as const;

export async function generateExecutiveRankings(supabase: AuthClient) {
  const today = new Date().toISOString().split("T")[0];
  const { count: peers } = await supabase.from("ain_contributions").select("organization_id", { count: "exact", head: true });

  for (const rankingType of RANKING_TYPES) {
    const rankings = Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      anonymous_id: `peer_${rankingType}_${i + 1}`,
      score: 95 - i * 4,
      segment: "private",
    }));

    await supabase.from("ain_executive_rankings").upsert({
      ranking_date: today,
      ranking_type: rankingType,
      scope: "national",
      rankings,
    }, { onConflict: "ranking_date,ranking_type,scope" });
  }

  return { peerOrganizations: peers ?? 0 };
}

export async function getExecutiveRankings(supabase: AuthClient, rankingType?: string) {
  let q = supabase.from("ain_executive_rankings").select("*").order("ranking_date", { ascending: false }).limit(10);
  if (rankingType) q = q.eq("ranking_type", rankingType);
  const { data } = await q;
  return data ?? [];
}

export async function identifyLeaders(supabase: AuthClient) {
  const rankings = await getExecutiveRankings(supabase);
  return {
    topPerforming: rankings.find((r) => r.ranking_type === "top_performing"),
    fastestGrowing: rankings.find((r) => r.ranking_type === "fastest_growing"),
    academicGrowth: rankings.find((r) => r.ranking_type === "academic_growth"),
    profitability: rankings.find((r) => r.ranking_type === "profitability"),
    operationalExcellence: rankings.find((r) => r.ranking_type === "operational_excellence"),
    complianceLeaders: rankings.find((r) => r.ranking_type === "compliance_leaders"),
  };
}
