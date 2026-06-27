export type EdiDomain =
  | "class"
  | "program"
  | "teacher"
  | "scheduling"
  | "financial"
  | "enrollment"
  | "student_success"
  | "capacity"
  | "strategic";

export type EdiPriority = "low" | "normal" | "high" | "critical";
export type EdiRiskLevel = "low" | "medium" | "high" | "critical";
export type EdiApprovalStatus = "pending" | "approved" | "rejected" | "deferred" | "superseded";

export interface DecisionCard {
  id?: string;
  schoolId: string;
  domain: EdiDomain;
  recommendationType: string;
  entityType?: string;
  entityId?: string;
  entityKey?: string;
  issue: string;
  evidence?: string;
  whatHappened?: string;
  whyHappened?: string;
  likelyNext?: string;
  supportingMetrics: Record<string, unknown>;
  financialImpact: number;
  operationalImpact: number;
  studentSuccessImpact: number;
  impactDetails?: Record<string, unknown>;
  riskLevel: EdiRiskLevel;
  priority: EdiPriority;
  confidenceScore: number;
  recommendationScore: number;
  estimatedTimeline?: string;
  recommendedAction: string;
  alternativeOptions: Array<{ action: string; impact?: string }>;
  decisionOwnerRole?: string;
  approvalStatus: EdiApprovalStatus;
  currentMargin?: number;
  targetMargin?: number;
  projectedMargin?: number;
  breakEvenEnrollment?: number;
  recommendedEnrollment?: number;
}

export interface ExecutiveScorecard {
  financialHealth: number;
  enrollmentHealth: number;
  studentSuccess: number;
  teacherEffectiveness: number;
  compliance: number;
  growth: number;
  parentEngagement: number;
  operationalEfficiency: number;
  capacity: number;
  risk: number;
  overallEnterpriseHealth: number;
}

export interface CapacitySnapshot {
  availableSeats: number;
  usedSeats: number;
  teacherUtilizationPct: number;
  roomUtilizationPct: number;
  scheduleUtilizationPct: number;
  campusUtilizationPct: number;
  programUtilizationPct: number;
  virtualCapacityHours: number;
  futureCapacitySeats?: number;
  projectedShortages: Record<string, unknown>;
}

export interface EdiBriefing {
  briefingType: string;
  title: string;
  summary?: string;
  content: Record<string, unknown>;
}

export interface EdiScenarioInput {
  tuitionChangePct?: number;
  enrollmentChangePct?: number;
  teacherHires?: number;
  classSizeIncrease?: number;
  sectionsAdded?: number;
  sectionsClosed?: number;
  facilityLeaseCost?: number;
  campusExpansionPct?: number;
}

export interface EdiScenarioResult {
  projectedRevenue: number;
  projectedExpenses: number;
  projectedEnrollment: number;
  projectedEbitda: number;
  projectedCashFlow: number;
  projectedMarginPct: number;
  operationalImpact: Record<string, unknown>;
  studentSuccessImpact: Record<string, unknown>;
}

export interface EducationalRoiRow {
  entityType: string;
  entityId?: string;
  entityKey?: string;
  financialRoi: number;
  studentGrowth?: number;
  attendanceImprovement?: number;
  behaviorImprovement?: number;
  goalAchievement?: number;
  parentEngagement?: number;
  retention?: number;
  overallEducationalRoi: number;
}

export interface DecisionHistoryRow {
  id: string;
  recommendationId?: string;
  decisionMade: string;
  reason?: string;
  outcomeStatus: string;
  actualFinancialImpact?: number;
  decidedAt: string;
}

export const EDI_AI_CAPABILITIES = [
  "generate_executive_narratives",
  "predict_enrollment",
  "predict_cash_flow",
  "predict_staffing_needs",
  "recommend_pricing",
  "optimize_scheduling",
  "identify_waste",
  "recommend_strategic_initiatives",
] as const;

export function scoreRecommendation(input: {
  financialImpact: number;
  priority: EdiPriority;
  confidenceScore: number;
  riskLevel: EdiRiskLevel;
}): number {
  const priorityWeight = { critical: 100, high: 75, normal: 50, low: 25 }[input.priority];
  const riskWeight = { critical: 30, high: 20, medium: 10, low: 5 }[input.riskLevel];
  return Math.round(priorityWeight + riskWeight + input.confidenceScore * 0.3 + Math.abs(input.financialImpact) * 0.001);
}

export function priorityFromMargin(marginPct: number, breakEvenGap: number): EdiPriority {
  if (marginPct < 0 || breakEvenGap < -5) return "critical";
  if (marginPct < 10 || breakEvenGap < 0) return "high";
  if (marginPct < 15) return "normal";
  return "low";
}
