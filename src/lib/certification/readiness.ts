import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ReadinessScores } from "@/lib/certification/types";
import { READINESS_THRESHOLD } from "@/lib/certification/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export function computeOverallReadiness(scores: Omit<ReadinessScores, "overall" | "isV1Certified">): ReadinessScores {
  const values = [
    scores.security, scores.performance, scores.accessibility, scores.mobile, scores.pwa,
    scores.testing, scores.integration, scores.documentation, scores.dr,
    scores.cloud, scores.training, scores.support, scores.operational,
  ];
  const overall = values.reduce((a, b) => a + b, 0) / values.length;
  const allPass = values.every((v) => v >= READINESS_THRESHOLD);

  return {
    ...scores,
    overall,
    isV1Certified: allPass && overall >= READINESS_THRESHOLD,
  };
}

export async function saveReadinessSnapshot(
  supabase: AuthClient,
  organizationId: string | null,
  scores: ReadinessScores
) {
  await supabase.from("cert_readiness_snapshots").upsert({
    organization_id: organizationId,
    snapshot_date: new Date().toISOString().split("T")[0],
    overall_score: scores.overall,
    security_score: scores.security,
    performance_score: scores.performance,
    accessibility_score: scores.accessibility,
    mobile_score: scores.mobile,
    pwa_score: scores.pwa,
    testing_score: scores.testing,
    integration_score: scores.integration,
    documentation_score: scores.documentation,
    dr_score: scores.dr,
    cloud_score: scores.cloud,
    training_score: scores.training,
    support_score: scores.support,
    operational_score: scores.operational,
    is_v1_certified: scores.isV1Certified,
    domain_scores: scores,
  }, { onConflict: "organization_id,snapshot_date" });
}

export async function getLatestReadiness(supabase: AuthClient, organizationId?: string | null) {
  let query = supabase.from("cert_readiness_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data } = await query.maybeSingle();
  return data;
}
