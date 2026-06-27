import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DecisionCard } from "@/lib/edi/types";
import { priorityFromMargin, scoreRecommendation } from "@/lib/edi/types";
import { computeClassProfitability } from "@/lib/financial-intelligence/profitability";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const TARGET_MARGIN = 15;

export async function generateClassDecisions(
  supabase: AuthClient,
  schoolId: string
): Promise<DecisionCard[]> {
  const classes = await computeClassProfitability(supabase, schoolId, "monthly");
  const cards: DecisionCard[] = [];

  for (const cls of classes) {
    const breakEvenGap = cls.currentEnrollment - cls.breakEvenEnrollment;
    const priority = priorityFromMargin(cls.marginPct, breakEvenGap);

    if (cls.currentEnrollment < cls.breakEvenEnrollment) {
      cards.push(buildClassCard(schoolId, cls, {
        type: "increase_enrollment",
        issue: `Class ${cls.sectionCode} is below break-even enrollment`,
        whatHappened: `Enrollment is ${cls.currentEnrollment} vs break-even of ${cls.breakEvenEnrollment}`,
        whyHappened: `Net margin is ${cls.marginPct.toFixed(1)}% with ${formatCurrency(cls.netMargin)} net margin`,
        likelyNext: "Continued losses unless enrollment increases or costs are reduced",
        action: `Increase marketing and waitlist promotion for ${cls.sectionCode}`,
        alternatives: [
          { action: "Combine with another under-enrolled section", impact: "Reduce fixed costs" },
          { action: "Reduce capacity / cancel section", impact: `Save ${formatCurrency(cls.totalCost)} monthly cost` },
          { action: "Assign different teacher", impact: "May reduce payroll allocation" },
        ],
        financialImpact: cls.netMargin,
        projectedMargin: cls.marginPct + 5,
        recommendedEnrollment: cls.breakEvenEnrollment + 2,
        priority: priority === "low" ? "high" : priority,
        riskLevel: cls.marginPct < 0 ? "critical" : "high",
      }));
    }

    if (cls.availableSeats > 0 && cls.marginPct >= TARGET_MARGIN) {
      cards.push(buildClassCard(schoolId, cls, {
        type: "increase_enrollment",
        issue: `Profitable class ${cls.sectionCode} has ${cls.availableSeats} open seats`,
        whatHappened: `Class is at ${cls.marginPct.toFixed(1)}% margin with available capacity`,
        whyHappened: "Strong unit economics with unfilled seats",
        likelyNext: "Revenue opportunity if seats are filled",
        action: "Increase enrollment — promote open seats to waitlist and admissions",
        alternatives: [
          { action: "Increase tuition for this section", impact: `+${formatCurrency(cls.revenuePerSeat * 0.05)} per seat at 5%` },
          { action: "Split into two sections if demand exceeds capacity", impact: "Expand program reach" },
        ],
        financialImpact: cls.profitPerSeat * cls.availableSeats,
        projectedMargin: cls.marginPct,
        recommendedEnrollment: cls.currentEnrollment + cls.availableSeats,
        priority: "normal",
        riskLevel: "low",
      }));
    }

    if (cls.marginPct < 5 && cls.currentEnrollment >= cls.breakEvenEnrollment) {
      cards.push(buildClassCard(schoolId, cls, {
        type: "increase_tuition",
        issue: `Class ${cls.sectionCode} margin below target (${cls.marginPct.toFixed(1)}%)`,
        whatHappened: "Class meets enrollment but margin is thin",
        whyHappened: "Allocated costs exceed revenue per seat at current pricing",
        likelyNext: "Margin compression if costs rise",
        action: "Consider tuition increase of 3–5% for this section",
        alternatives: [
          { action: "Reduce tuition to fill remaining seats", impact: "Volume over margin strategy" },
          { action: "Move to lower-cost classroom/time slot", impact: "Reduce facility allocation" },
        ],
        financialImpact: cls.revenue * 0.05,
        projectedMargin: cls.marginPct + 5,
        recommendedEnrollment: cls.currentEnrollment,
        priority: "normal",
        riskLevel: "medium",
      }));
    }

    if (cls.marginPct < -10 && cls.currentEnrollment < cls.breakEvenEnrollment * 0.5) {
      cards.push(buildClassCard(schoolId, cls, {
        type: "cancel_class",
        issue: `Class ${cls.sectionCode} is severely underperforming`,
        whatHappened: `Only ${cls.currentEnrollment} enrolled with ${cls.marginPct.toFixed(1)}% margin`,
        whyHappened: "Enrollment and pricing do not support instructional costs",
        likelyNext: "Continued financial drain without intervention",
        action: "Evaluate canceling class or combining sections",
        alternatives: [
          { action: "Combine sections", impact: "Preserve student access" },
          { action: "Waitlist and defer", impact: "Delay decision 30 days" },
        ],
        financialImpact: -cls.totalCost,
        projectedMargin: 0,
        recommendedEnrollment: 0,
        priority: "critical",
        riskLevel: "critical",
      }));
    }
  }

  return cards;
}

function buildClassCard(
  schoolId: string,
  cls: Awaited<ReturnType<typeof computeClassProfitability>>[number],
  input: {
    type: string;
    issue: string;
    whatHappened: string;
    whyHappened: string;
    likelyNext: string;
    action: string;
    alternatives: DecisionCard["alternativeOptions"];
    financialImpact: number;
    projectedMargin: number;
    recommendedEnrollment: number;
    priority: DecisionCard["priority"];
    riskLevel: DecisionCard["riskLevel"];
  }
): DecisionCard {
  const card: DecisionCard = {
    schoolId,
    domain: "class",
    recommendationType: input.type,
    entityType: "class",
    entityId: cls.courseSectionId,
    entityKey: cls.sectionCode,
    issue: input.issue,
    evidence: `Margin ${cls.marginPct.toFixed(1)}%, enrollment ${cls.currentEnrollment}/${cls.breakEvenEnrollment} break-even`,
    whatHappened: input.whatHappened,
    whyHappened: input.whyHappened,
    likelyNext: input.likelyNext,
    supportingMetrics: {
      revenue: cls.revenue,
      total_cost: cls.totalCost,
      net_margin: cls.netMargin,
      revenue_per_seat: cls.revenuePerSeat,
      profit_per_hour: cls.profitPerHour,
    },
    financialImpact: input.financialImpact,
    operationalImpact: cls.availableSeats,
    studentSuccessImpact: cls.currentEnrollment,
    riskLevel: input.riskLevel,
    priority: input.priority,
    confidenceScore: 82,
    recommendationScore: 0,
    estimatedTimeline: "30–90 days",
    recommendedAction: input.action,
    alternativeOptions: input.alternatives,
    decisionOwnerRole: "SCHOOL_LEADER",
    approvalStatus: "pending",
    currentMargin: cls.marginPct,
    targetMargin: TARGET_MARGIN,
    projectedMargin: input.projectedMargin,
    breakEvenEnrollment: cls.breakEvenEnrollment,
    recommendedEnrollment: input.recommendedEnrollment,
  };
  card.recommendationScore = scoreRecommendation(card);
  return card;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
