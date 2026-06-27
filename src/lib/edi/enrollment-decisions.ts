import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DecisionCard } from "@/lib/edi/types";
import { scoreRecommendation } from "@/lib/edi/types";
import { getCommandCenterMetrics } from "@/lib/executive/command-center";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function generateEnrollmentDecisions(
  supabase: AuthClient,
  schoolId: string
): Promise<DecisionCard[]> {
  const metrics = await getCommandCenterMetrics(supabase, schoolId);
  const cards: DecisionCard[] = [];

  if (metrics.enrollmentTrendPct != null && metrics.enrollmentTrendPct < 0) {
    cards.push(buildEnrollmentCard(schoolId, {
      type: "increase_marketing",
      issue: "Enrollment declining",
      action: "Increase marketing spend and admissions outreach",
      evidence: `${metrics.enrollmentTrendPct}% enrollment trend`,
      financialImpact: metrics.revenue * 0.1,
      priority: "critical",
      riskLevel: "critical",
    }));
  }

  if (metrics.admissionsPipeline < metrics.enrollment * 0.2 && metrics.enrollment > 0) {
    cards.push(buildEnrollmentCard(schoolId, {
      type: "target_referral_sources",
      issue: "Admissions pipeline is thin relative to enrollment",
      action: "Target referral sources and funding program partnerships",
      evidence: `Pipeline ${metrics.admissionsPipeline} vs enrollment ${metrics.enrollment}`,
      financialImpact: metrics.revenue * 0.15,
      priority: "high",
      riskLevel: "high",
    }));
  }

  if (metrics.enrollmentTrendPct != null && metrics.enrollmentTrendPct >= 5) {
    cards.push(buildEnrollmentCard(schoolId, {
      type: "add_sections",
      issue: "Enrollment growing — capacity may be constrained",
      action: "Add sections and recruit teachers for high-demand grade levels",
      evidence: `+${metrics.enrollmentTrendPct}% enrollment growth`,
      financialImpact: metrics.revenue * 0.2,
      priority: "high",
      riskLevel: "medium",
    }));
  }

  const { count: waitlist } = await supabase
    .from("admissions_leads")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .in("lead_status", ["waitlisted", "qualified", "tour_scheduled"]);

  if ((waitlist ?? 0) > 10) {
    cards.push(buildEnrollmentCard(schoolId, {
      type: "target_grade_levels",
      issue: `${waitlist} applicants waitlisted or under review`,
      action: "Open sections for grade levels with highest waitlist demand",
      evidence: `${waitlist} pending applications`,
      financialImpact: (waitlist ?? 0) * 5000,
      priority: "normal",
      riskLevel: "low",
    }));
  }

  return cards;
}

function buildEnrollmentCard(
  schoolId: string,
  input: {
    type: string;
    issue: string;
    action: string;
    evidence: string;
    financialImpact: number;
    priority: DecisionCard["priority"];
    riskLevel: DecisionCard["riskLevel"];
  }
): DecisionCard {
  const card: DecisionCard = {
    schoolId,
    domain: "enrollment",
    recommendationType: input.type,
    issue: input.issue,
    evidence: input.evidence,
    whatHappened: input.issue,
    whyHappened: "Enrollment and admissions metrics indicate gap or opportunity",
    likelyNext: input.priority === "critical" ? "Revenue decline if unaddressed" : "Growth if action taken",
    supportingMetrics: { evidence: input.evidence },
    financialImpact: input.financialImpact,
    operationalImpact: 0,
    studentSuccessImpact: 5,
    riskLevel: input.riskLevel,
    priority: input.priority,
    confidenceScore: 77,
    recommendationScore: 0,
    estimatedTimeline: "60–120 days",
    recommendedAction: input.action,
    alternativeOptions: [
      { action: "Close low-demand sections", impact: "Reallocate resources" },
      { action: "Target specific locations", impact: "Geographic expansion" },
    ],
    decisionOwnerRole: "CEO",
    approvalStatus: "pending",
  };
  card.recommendationScore = scoreRecommendation(card);
  return card;
}
