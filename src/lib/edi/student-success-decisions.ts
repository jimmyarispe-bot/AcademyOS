import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DecisionCard } from "@/lib/edi/types";
import { scoreRecommendation } from "@/lib/edi/types";
import { getCommandCenterMetrics } from "@/lib/executive/command-center";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function generateStudentSuccessDecisions(
  supabase: AuthClient,
  schoolId: string
): Promise<DecisionCard[]> {
  const metrics = await getCommandCenterMetrics(supabase, schoolId);
  const cards: DecisionCard[] = [];

  if (metrics.attendanceRate != null && metrics.attendanceRate < 90) {
    cards.push(buildSuccessCard(schoolId, {
      type: "attendance_intervention",
      issue: "Network attendance below 90% target",
      action: "Deploy attendance intervention protocol for at-risk students",
      evidence: `Attendance rate ${metrics.attendanceRate}%`,
      studentSuccessImpact: 10,
      priority: "high",
      riskLevel: "high",
    }));
  }

  if (metrics.avgSuccessScore != null && metrics.avgSuccessScore < 70) {
    cards.push(buildSuccessCard(schoolId, {
      type: "intervention_review",
      issue: "Average Student Success Score below target",
      action: "Review weak interventions and scale strong intervention models",
      evidence: `Avg success score ${metrics.avgSuccessScore}`,
      studentSuccessImpact: 15,
      priority: "high",
      riskLevel: "medium",
    }));
  }

  const { data: atRisk } = await supabase
    .from("students")
    .select("id, first_name, last_name, success_score")
    .eq("school_id", schoolId)
    .eq("lifecycle_stage", "active")
    .lt("success_score", 60)
    .limit(20);

  for (const st of atRisk ?? []) {
    cards.push(buildSuccessCard(schoolId, {
      type: "student_at_risk",
      issue: `Student at risk: ${st.first_name} ${st.last_name}`,
      action: "Assign success coach and review intervention plan",
      evidence: `Success score ${st.success_score}`,
      entityId: st.id,
      entityKey: `${st.first_name} ${st.last_name}`,
      studentSuccessImpact: 20,
      priority: "high",
      riskLevel: "high",
    }));
  }

  if (metrics.interventionEffectiveness != null && metrics.interventionEffectiveness < 60) {
    cards.push(buildSuccessCard(schoolId, {
      type: "weak_intervention",
      issue: "Intervention effectiveness below 60%",
      action: "Audit intervention programs and reallocate to highest-ROI models",
      evidence: `Effectiveness ${metrics.interventionEffectiveness}%`,
      studentSuccessImpact: 12,
      priority: "normal",
      riskLevel: "medium",
    }));
  }

  return cards;
}

function buildSuccessCard(
  schoolId: string,
  input: {
    type: string;
    issue: string;
    action: string;
    evidence: string;
    entityId?: string;
    entityKey?: string;
    studentSuccessImpact: number;
    priority: DecisionCard["priority"];
    riskLevel: DecisionCard["riskLevel"];
  }
): DecisionCard {
  const card: DecisionCard = {
    schoolId,
    domain: "student_success",
    recommendationType: input.type,
    entityType: input.entityId ? "student" : undefined,
    entityId: input.entityId,
    entityKey: input.entityKey,
    issue: input.issue,
    evidence: input.evidence,
    whatHappened: input.issue,
    whyHappened: "SSIS success metrics indicate student or program risk",
    likelyNext: "Retention and outcomes decline without intervention",
    supportingMetrics: { evidence: input.evidence },
    financialImpact: -2000,
    operationalImpact: 1,
    studentSuccessImpact: input.studentSuccessImpact,
    riskLevel: input.riskLevel,
    priority: input.priority,
    confidenceScore: 83,
    recommendationScore: 0,
    estimatedTimeline: "14–45 days",
    recommendedAction: input.action,
    alternativeOptions: [
      { action: "Parent engagement outreach", impact: "Address engagement risks" },
      { action: "Funding review", impact: "Ensure aid continuity" },
    ],
    decisionOwnerRole: "SCHOOL_LEADER",
    approvalStatus: "pending",
  };
  card.recommendationScore = scoreRecommendation(card);
  return card;
}
