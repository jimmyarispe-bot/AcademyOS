import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DecisionCard } from "@/lib/edi/types";
import { scoreRecommendation } from "@/lib/edi/types";
import { getExecutiveFinancialDashboard } from "@/lib/financial-intelligence/executive";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function generateFinancialDecisions(
  supabase: AuthClient,
  schoolId: string
): Promise<DecisionCard[]> {
  const [fi, finance] = await Promise.all([
    getExecutiveFinancialDashboard(supabase, schoolId),
    getFinanceExecutiveDashboard(supabase, schoolId),
  ]);

  const cards: DecisionCard[] = [];

  if (finance.collectionRate < 85) {
    cards.push(buildFinancialCard(schoolId, {
      type: "cash_flow_improvement",
      issue: "Collection rate below target",
      action: "Implement collection follow-up and payment plan outreach",
      evidence: `Collection rate ${finance.collectionRate}%`,
      financialImpact: finance.outstanding * 0.2,
      priority: "high",
      riskLevel: "high",
    }));
  }

  if (fi.classesBelowBreakeven > 3) {
    cards.push(buildFinancialCard(schoolId, {
      type: "program_pricing",
      issue: `${fi.classesBelowBreakeven} classes below break-even`,
      action: "Review tuition and program pricing across underperforming classes",
      evidence: "Financial Intelligence break-even analysis",
      financialImpact: fi.classesBelowBreakeven * -2000,
      priority: "critical",
      riskLevel: "critical",
    }));
  }

  if (finance.scholarshipsAwarded > finance.totalBilled * 0.25) {
    cards.push(buildFinancialCard(schoolId, {
      type: "scholarship_allocation",
      issue: "Scholarship allocation exceeds 25% of billed revenue",
      action: "Optimize scholarship allocation — align with enrollment goals",
      evidence: `Scholarships ${formatCurrency(finance.scholarshipsAwarded)}`,
      financialImpact: -finance.scholarshipsAwarded * 0.05,
      priority: "high",
      riskLevel: "medium",
    }));
  }

  if (fi.forecastPayroll && fi.forecastRevenue && fi.forecastPayroll > fi.forecastRevenue * 0.5) {
    cards.push(buildFinancialCard(schoolId, {
      type: "payroll_optimization",
      issue: "Projected payroll exceeds 50% of forecast revenue",
      action: "Review staffing levels and payroll optimization",
      evidence: "FI forecast integration",
      financialImpact: -(fi.forecastPayroll - fi.forecastRevenue * 0.45),
      priority: "high",
      riskLevel: "high",
    }));
  }

  cards.push(buildFinancialCard(schoolId, {
    type: "revenue_opportunity",
    issue: "Tuition adjustment scenario available",
    action: "Model 3–5% tuition increase with enrollment sensitivity analysis",
    evidence: `Current billed ${formatCurrency(finance.totalBilled)}`,
    financialImpact: finance.totalBilled * 0.04,
    priority: "normal",
    riskLevel: "medium",
  }));

  return cards;
}

function buildFinancialCard(
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
    domain: "financial",
    recommendationType: input.type,
    issue: input.issue,
    evidence: input.evidence,
    whatHappened: input.issue,
    whyHappened: "Financial Intelligence and operational finance metrics indicate gap",
    likelyNext: input.financialImpact < 0 ? "Margin and cash pressure" : "Revenue growth opportunity",
    supportingMetrics: { evidence: input.evidence },
    financialImpact: input.financialImpact,
    operationalImpact: 0,
    studentSuccessImpact: 0,
    riskLevel: input.riskLevel,
    priority: input.priority,
    confidenceScore: 80,
    recommendationScore: 0,
    estimatedTimeline: "30–90 days",
    recommendedAction: input.action,
    alternativeOptions: [
      { action: "Run EDI scenario comparison", impact: "Compare multiple options" },
      { action: "Defer decision", impact: "Monitor 30 days" },
    ],
    decisionOwnerRole: "CEO",
    approvalStatus: "pending",
  };
  card.recommendationScore = scoreRecommendation(card);
  return card;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
