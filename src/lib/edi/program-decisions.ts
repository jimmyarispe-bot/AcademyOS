import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DecisionCard } from "@/lib/edi/types";
import { scoreRecommendation } from "@/lib/edi/types";
import { computeProgramProfitability } from "@/lib/financial-intelligence/profitability";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function generateProgramDecisions(
  supabase: AuthClient,
  schoolId: string
): Promise<DecisionCard[]> {
  const programs = await computeProgramProfitability(supabase, schoolId);
  const cards: DecisionCard[] = [];

  for (const prog of programs) {
    const marginPct = prog.revenue ? (prog.netMargin / prog.revenue) * 100 : 0;

    if (prog.netMargin < 0) {
      cards.push(buildProgramCard(schoolId, prog, marginPct, {
        type: "reduce",
        issue: `Program "${prog.program}" is losing money`,
        action: "Reduce program scope or restructure staffing",
        alternatives: [
          { action: "Merge with related program", impact: "Shared overhead" },
          { action: "Close program", impact: `Stop ${formatCurrency(Math.abs(prog.netMargin))} monthly loss` },
          { action: "Seek grants", impact: "Offset scholarship/state funding gaps" },
        ],
        priority: "critical",
        riskLevel: "critical",
        financialImpact: prog.netMargin,
      }));
    } else if (marginPct >= 20) {
      cards.push(buildProgramCard(schoolId, prog, marginPct, {
        type: "expand",
        issue: `Program "${prog.program}" is highly profitable (${marginPct.toFixed(1)}% margin)`,
        action: "Expand program — add sections and marketing investment",
        alternatives: [
          { action: "Increase tuition", impact: `+${formatCurrency(prog.revenue * 0.05)} at 5%` },
          { action: "Increase staffing to grow capacity", impact: "Capture demand" },
        ],
        priority: "normal",
        riskLevel: "low",
        financialImpact: prog.netMargin * 0.2,
      }));
    } else if (prog.scholarships > prog.revenue * 0.3) {
      cards.push(buildProgramCard(schoolId, prog, marginPct, {
        type: "increase_scholarships_review",
        issue: `Program "${prog.program}" has high scholarship allocation`,
        action: "Review scholarship allocation and ESA optimization",
        alternatives: [
          { action: "Increase scholarships strategically", impact: "Enrollment growth" },
          { action: "Reduce scholarships", impact: "Improve margin" },
        ],
        priority: "high",
        riskLevel: "medium",
        financialImpact: -prog.scholarships * 0.1,
      }));
    }
  }

  return cards;
}

function buildProgramCard(
  schoolId: string,
  prog: Awaited<ReturnType<typeof computeProgramProfitability>>[number],
  marginPct: number,
  input: {
    type: string;
    issue: string;
    action: string;
    alternatives: DecisionCard["alternativeOptions"];
    priority: DecisionCard["priority"];
    riskLevel: DecisionCard["riskLevel"];
    financialImpact: number;
  }
): DecisionCard {
  const card: DecisionCard = {
    schoolId,
    domain: "program",
    recommendationType: input.type,
    entityType: "program",
    entityKey: prog.program,
    issue: input.issue,
    evidence: `Revenue ${formatCurrency(prog.revenue)}, net margin ${formatCurrency(prog.netMargin)}`,
    whatHappened: `Program generates ${formatCurrency(prog.revenue)} with ${marginPct.toFixed(1)}% margin`,
    whyHappened: `Payroll ${formatCurrency(prog.payroll)}, scholarships ${formatCurrency(prog.scholarships)}`,
    likelyNext: input.financialImpact < 0 ? "Continued losses without restructuring" : "Growth opportunity if capacity added",
    supportingMetrics: {
      revenue: prog.revenue,
      expenses: prog.expenses,
      ebitda: prog.ebitdaContribution,
      state_funding: prog.stateFunding,
      grants: prog.grants,
    },
    financialImpact: input.financialImpact,
    operationalImpact: prog.payroll,
    studentSuccessImpact: 0,
    riskLevel: input.riskLevel,
    priority: input.priority,
    confidenceScore: 78,
    recommendationScore: 0,
    estimatedTimeline: "60–120 days",
    recommendedAction: input.action,
    alternativeOptions: input.alternatives,
    decisionOwnerRole: "CEO",
    approvalStatus: "pending",
    currentMargin: marginPct,
    targetMargin: 15,
    projectedMargin: marginPct + (input.type === "expand" ? 3 : -5),
  };
  card.recommendationScore = scoreRecommendation(card);
  return card;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
