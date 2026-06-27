import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DecisionCard } from "@/lib/edi/types";
import { scoreRecommendation } from "@/lib/edi/types";
import { computeTeacherProfitability } from "@/lib/financial-intelligence/profitability";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function generateTeacherDecisions(
  supabase: AuthClient,
  schoolId: string
): Promise<DecisionCard[]> {
  const teachers = await computeTeacherProfitability(supabase, schoolId);
  const cards: DecisionCard[] = [];

  for (const t of teachers) {
    const marginPct = t.revenueGenerated ? (t.netMargin / t.revenueGenerated) * 100 : 0;

    if (t.instructionalHours > 0 && t.revenuePerHour > t.costPerHour * 1.5 && t.classesTaught < 4) {
      cards.push(buildTeacherCard(schoolId, t, {
        type: "additional_classes",
        issue: `${t.employeeName ?? "Teacher"} has strong revenue/hour with capacity`,
        action: "Assign additional classes — high ROI instructional capacity",
        priority: "normal",
        riskLevel: "low",
        financialImpact: t.revenuePerHour * 10,
        projectedMargin: marginPct,
      }));
    }

    if (t.costPerHour > t.revenuePerHour && t.instructionalHours > 20) {
      cards.push(buildTeacherCard(schoolId, t, {
        type: "schedule_adjustment",
        issue: `${t.employeeName ?? "Teacher"} cost exceeds revenue generated`,
        action: "Adjust schedule or redistribute students to improve margin",
        priority: "high",
        riskLevel: "medium",
        financialImpact: t.netMargin,
        projectedMargin: marginPct + 10,
      }));
    }

    if (t.studentsServed > 30 && t.classesTaught >= 4) {
      cards.push(buildTeacherCard(schoolId, t, {
        type: "redistribution",
        issue: `${t.employeeName ?? "Teacher"} may be overloaded (${t.studentsServed} students)`,
        action: "Redistribute workload or hire additional instructional staff",
        priority: "high",
        riskLevel: "high",
        financialImpact: -5000,
        projectedMargin: marginPct,
      }));
    }

    if (marginPct < 0) {
      cards.push(buildTeacherCard(schoolId, t, {
        type: "professional_development",
        issue: `${t.employeeName ?? "Teacher"} negative instructional contribution`,
        action: "Professional development + schedule optimization review",
        priority: "normal",
        riskLevel: "medium",
        financialImpact: t.netMargin,
        projectedMargin: 5,
      }));
    }
  }

  return cards;
}

function buildTeacherCard(
  schoolId: string,
  t: Awaited<ReturnType<typeof computeTeacherProfitability>>[number],
  input: {
    type: string;
    issue: string;
    action: string;
    priority: DecisionCard["priority"];
    riskLevel: DecisionCard["riskLevel"];
    financialImpact: number;
    projectedMargin: number;
  }
): DecisionCard {
  const card: DecisionCard = {
    schoolId,
    domain: "teacher",
    recommendationType: input.type,
    entityType: "teacher",
    entityId: t.employeeId,
    issue: input.issue,
    evidence: `${t.classesTaught} classes, ${t.studentsServed} students, ${t.instructionalHours.toFixed(0)} hours`,
    whatHappened: `Revenue ${formatCurrency(t.revenueGenerated)}, net margin ${formatCurrency(t.netMargin)}`,
    whyHappened: `Payroll ${formatCurrency(t.payroll + t.benefits)}, overhead ${formatCurrency(t.allocatedOverhead)}`,
    likelyNext: input.financialImpact > 0 ? "Revenue growth if capacity utilized" : "Margin pressure continues",
    supportingMetrics: {
      revenue_per_hour: t.revenuePerHour,
      cost_per_hour: t.costPerHour,
      classes_taught: t.classesTaught,
      students_served: t.studentsServed,
    },
    financialImpact: input.financialImpact,
    operationalImpact: t.instructionalHours,
    studentSuccessImpact: t.studentsServed,
    riskLevel: input.riskLevel,
    priority: input.priority,
    confidenceScore: 75,
    recommendationScore: 0,
    estimatedTimeline: "30–60 days",
    recommendedAction: input.action,
    alternativeOptions: [
      { action: "Hire additional teacher", impact: "Reduce overload" },
      { action: "Schedule adjustments", impact: "Optimize hours" },
    ],
    decisionOwnerRole: "SCHOOL_LEADER",
    approvalStatus: "pending",
    projectedMargin: input.projectedMargin,
  };
  card.recommendationScore = scoreRecommendation(card);
  return card;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
