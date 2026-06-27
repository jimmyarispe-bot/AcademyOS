import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function recordDecision(
  supabase: AuthClient,
  input: {
    schoolId: string;
    recommendationId?: string;
    decisionMade: string;
    approvedBy?: string;
    reason?: string;
    projectedFinancialImpact?: number;
    projectedEnrollmentImpact?: number;
    projectedStudentSuccessImpact?: number;
  }
) {
  const { data, error } = await supabase
    .from("edi_decision_history")
    .insert({
      school_id: input.schoolId,
      recommendation_id: input.recommendationId ?? null,
      decision_made: input.decisionMade,
      approved_by: input.approvedBy ?? null,
      reason: input.reason ?? null,
      projected_financial_impact: input.projectedFinancialImpact ?? null,
      projected_enrollment_impact: input.projectedEnrollmentImpact ?? null,
      projected_student_success_impact: input.projectedStudentSuccessImpact ?? null,
      outcome_status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (input.recommendationId) {
    await supabase
      .from("edi_recommendations")
      .update({ approval_status: "approved", status: "accepted" })
      .eq("id", input.recommendationId);
  }

  return { id: data.id };
}

export async function updateDecisionOutcome(
  supabase: AuthClient,
  decisionId: string,
  input: {
    outcomeStatus: string;
    actualFinancialImpact?: number;
    actualEnrollmentImpact?: number;
    actualStudentSuccessImpact?: number;
    lessonsLearned?: string;
  }
) {
  await supabase
    .from("edi_decision_history")
    .update({
      outcome_status: input.outcomeStatus,
      actual_financial_impact: input.actualFinancialImpact ?? null,
      actual_enrollment_impact: input.actualEnrollmentImpact ?? null,
      actual_student_success_impact: input.actualStudentSuccessImpact ?? null,
      lessons_learned: input.lessonsLearned ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", decisionId);
}

export async function getDecisionHistory(supabase: AuthClient, schoolId: string, limit = 50) {
  const { data } = await supabase
    .from("edi_decision_history")
    .select("*, edi_recommendations(issue, domain, recommended_action)")
    .eq("school_id", schoolId)
    .order("decided_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function rejectRecommendation(
  supabase: AuthClient,
  recommendationId: string,
  input: { approvedBy?: string; reason?: string; schoolId: string }
) {
  await supabase
    .from("edi_recommendations")
    .update({ approval_status: "rejected", status: "rejected" })
    .eq("id", recommendationId);

  return recordDecision(supabase, {
    schoolId: input.schoolId,
    recommendationId,
    decisionMade: "rejected",
    approvedBy: input.approvedBy,
    reason: input.reason,
  });
}
