export type ParticipationStatus = "opt_in" | "opt_out" | "selective";
export type AnonymizationLevel = "standard" | "enhanced" | "minimal";
export type BenchmarkScope = "regional" | "national" | "international" | "peer";
export type MetricCategory = "academic" | "financial" | "staffing" | "enrollment" | "compliance" | "operations";

export const AIN_NAV = [
  { href: "/dashboard/network/benchmarks", label: "Benchmarks", exact: true as const },
  { href: "/dashboard/network/academics", label: "Academics" },
  { href: "/dashboard/network/finance", label: "Finance" },
  { href: "/dashboard/network/staffing", label: "Staffing" },
  { href: "/dashboard/network/enrollment", label: "Enrollment" },
  { href: "/dashboard/network/compliance", label: "Compliance" },
  { href: "/dashboard/network/student-success", label: "Student Success" },
  { href: "/dashboard/network/operations", label: "Operations" },
  { href: "/dashboard/network/forecasting", label: "Forecasting" },
  { href: "/dashboard/network/recommendations", label: "Recommendations" },
  { href: "/dashboard/network/research", label: "Research" },
  { href: "/dashboard/network/settings", label: "Settings" },
] as const;

export const PEER_SEGMENTS = [
  { key: "similar_enrollment", label: "Similar Enrollment" },
  { key: "similar_tuition", label: "Similar Tuition" },
  { key: "special_education", label: "Special Education" },
  { key: "private", label: "Private Schools" },
  { key: "virtual", label: "Virtual Schools" },
  { key: "hybrid", label: "Hybrid Schools" },
  { key: "charter", label: "Charter Schools" },
  { key: "independent", label: "Independent Schools" },
] as const;

export const DATA_CATEGORIES = [
  "academic", "financial", "staffing", "enrollment", "compliance", "operations",
] as const;

export const ACADEMIC_METRICS = [
  "reading_growth", "writing_growth", "math_growth", "structured_literacy_growth",
  "map_growth", "attendance", "graduation", "retention", "intervention_effectiveness", "student_success_score",
] as const;

export const FINANCIAL_METRICS = [
  "revenue_per_student", "ebitda", "operating_margin", "class_profitability",
  "teacher_cost", "payroll_pct", "scholarship_utilization", "state_funding", "collection_rate", "cash_flow",
] as const;

export const STAFFING_METRICS = [
  "teacher_caseload", "student_ratio", "turnover", "compensation",
  "professional_development", "certification", "absenteeism", "retention",
] as const;

export const ENROLLMENT_METRICS = [
  "lead_conversion", "acceptance_rate", "yield", "retention",
  "attrition", "marketing_roi", "enrollment_growth",
] as const;

export const AIN_AI_READINESS = [
  "detect_trends", "predict_outcomes", "recommend_interventions", "generate_executive_summaries",
] as const;

export interface NetworkHubSummary {
  participationStatus: ParticipationStatus;
  peerCount: number;
  benchmarkCount: number;
  recommendationCount: number;
  researchReportCount: number;
}
