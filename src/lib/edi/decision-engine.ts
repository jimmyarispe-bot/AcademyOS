import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DecisionCard } from "@/lib/edi/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function persistRecommendation(supabase: AuthClient, card: DecisionCard) {
  const row = {
    school_id: card.schoolId,
    domain: card.domain,
    recommendation_type: card.recommendationType,
    entity_type: card.entityType ?? null,
    entity_id: card.entityId ?? null,
    entity_key: card.entityKey ?? null,
    issue: card.issue,
    evidence: card.evidence ?? null,
    what_happened: card.whatHappened ?? null,
    why_happened: card.whyHappened ?? null,
    likely_next: card.likelyNext ?? null,
    supporting_metrics: card.supportingMetrics,
    financial_impact: card.financialImpact,
    operational_impact: card.operationalImpact,
    student_success_impact: card.studentSuccessImpact,
    impact_details: card.impactDetails ?? {},
    risk_level: card.riskLevel,
    priority: card.priority,
    confidence_score: card.confidenceScore,
    recommendation_score: card.recommendationScore,
    estimated_timeline: card.estimatedTimeline ?? null,
    recommended_action: card.recommendedAction,
    alternative_options: card.alternativeOptions,
    decision_owner_role: card.decisionOwnerRole ?? "SCHOOL_LEADER",
    approval_status: card.approvalStatus,
    current_margin: card.currentMargin ?? null,
    target_margin: card.targetMargin ?? 15,
    projected_margin: card.projectedMargin ?? null,
    break_even_enrollment: card.breakEvenEnrollment ?? null,
    recommended_enrollment: card.recommendedEnrollment ?? null,
    status: "active",
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  };

  await supabase.from("edi_recommendations").upsert(row, {
    onConflict: "school_id,domain,recommendation_type,entity_type,entity_id,entity_key",
  });
}

export async function persistRecommendations(supabase: AuthClient, cards: DecisionCard[]) {
  for (const card of cards) {
    await persistRecommendation(supabase, card);
  }
}

export async function getRecommendations(
  supabase: AuthClient,
  schoolId: string,
  filters?: { domain?: string; limit?: number }
) {
  let query = supabase
    .from("edi_recommendations")
    .select("*")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("recommendation_score", { ascending: false });

  if (filters?.domain) query = query.eq("domain", filters.domain);
  query = query.limit(filters?.limit ?? 100);

  const { data } = await query;
  return data ?? [];
}

export function mapRowToDecisionCard(row: Record<string, unknown>): DecisionCard {
  return {
    id: row.id as string,
    schoolId: row.school_id as string,
    domain: row.domain as DecisionCard["domain"],
    recommendationType: row.recommendation_type as string,
    entityType: row.entity_type as string | undefined,
    entityId: row.entity_id as string | undefined,
    entityKey: row.entity_key as string | undefined,
    issue: row.issue as string,
    evidence: row.evidence as string | undefined,
    whatHappened: row.what_happened as string | undefined,
    whyHappened: row.why_happened as string | undefined,
    likelyNext: row.likely_next as string | undefined,
    supportingMetrics: (row.supporting_metrics as Record<string, unknown>) ?? {},
    financialImpact: Number(row.financial_impact),
    operationalImpact: Number(row.operational_impact),
    studentSuccessImpact: Number(row.student_success_impact),
    impactDetails: (row.impact_details as Record<string, unknown>) ?? {},
    riskLevel: row.risk_level as DecisionCard["riskLevel"],
    priority: row.priority as DecisionCard["priority"],
    confidenceScore: Number(row.confidence_score),
    recommendationScore: Number(row.recommendation_score),
    estimatedTimeline: row.estimated_timeline as string | undefined,
    recommendedAction: row.recommended_action as string,
    alternativeOptions: (row.alternative_options as DecisionCard["alternativeOptions"]) ?? [],
    decisionOwnerRole: row.decision_owner_role as string | undefined,
    approvalStatus: row.approval_status as DecisionCard["approvalStatus"],
    currentMargin: row.current_margin != null ? Number(row.current_margin) : undefined,
    targetMargin: row.target_margin != null ? Number(row.target_margin) : undefined,
    projectedMargin: row.projected_margin != null ? Number(row.projected_margin) : undefined,
    breakEvenEnrollment: row.break_even_enrollment != null ? Number(row.break_even_enrollment) : undefined,
    recommendedEnrollment: row.recommended_enrollment != null ? Number(row.recommended_enrollment) : undefined,
  };
}
