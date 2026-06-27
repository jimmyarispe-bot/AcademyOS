export type FiHealthIndicator = "green" | "yellow" | "red";

export type FiEntityType = "class" | "teacher" | "program" | "student" | "school" | "family" | "campus";

export type FiPeriodType = "weekly" | "monthly" | "quarterly" | "annual";

export interface ClassProfitabilityRow {
  courseSectionId: string;
  sectionCode: string;
  sectionName?: string;
  revenue: number;
  teacherPay: number;
  benefitsAllocation: number;
  payrollTaxes: number;
  technologyCost: number;
  curriculumCost: number;
  facilityCost: number;
  adminOverhead: number;
  marketingAllocation: number;
  insuranceAllocation: number;
  utilitiesAllocation: number;
  occupancyAllocation: number;
  sharedCosts: number;
  totalCost: number;
  grossMargin: number;
  netMargin: number;
  contributionMargin: number;
  marginPct: number;
  breakEvenEnrollment: number;
  currentEnrollment: number;
  availableSeats: number;
  revenuePerSeat: number;
  profitPerSeat: number;
  revenuePerHour: number;
  costPerHour: number;
  profitPerHour: number;
  healthIndicator: FiHealthIndicator;
}

export interface TeacherProfitabilityRow {
  employeeId: string;
  employeeName?: string;
  revenueGenerated: number;
  classesTaught: number;
  studentsServed: number;
  instructionalHours: number;
  payroll: number;
  benefits: number;
  payrollTaxes: number;
  allocatedOverhead: number;
  revenuePerHour: number;
  costPerHour: number;
  grossMargin: number;
  netMargin: number;
  healthIndicator: FiHealthIndicator;
}

export interface ProgramProfitabilityRow {
  program: string;
  revenue: number;
  expenses: number;
  payroll: number;
  scholarships: number;
  stateFunding: number;
  grants: number;
  occupancy: number;
  technology: number;
  administration: number;
  netMargin: number;
  ebitdaContribution: number;
  enrollmentTrend: number | null;
  healthIndicator: FiHealthIndicator;
}

export interface StudentEconomicsRow {
  studentId: string;
  studentName?: string;
  tuition: number;
  scholarships: number;
  esa: number;
  stateFunding: number;
  grants: number;
  additionalServices: number;
  totalRevenue: number;
  allocatedCosts: number;
  profitability: number;
  lifetimeValue: number;
  healthIndicator: FiHealthIndicator;
}

export interface FamilyAnalyticsRow {
  familyId: string;
  lifetimeRevenue: number;
  outstandingBalance: number;
  aidReceived: number;
  paymentReliability: number;
  avgMonthlyRevenue: number;
  collectionRisk: FiHealthIndicator;
}

export interface SchoolFinancialsRow {
  schoolId: string;
  revenue: number;
  expenses: number;
  payroll: number;
  ebitda: number;
  cashFlow: number;
  operatingMargin: number;
  netMargin: number;
  enrollmentRevenue: number;
  revenuePerStudent: number;
  revenuePerClassroom: number;
  revenuePerTeacher: number;
  healthIndicator: FiHealthIndicator;
}

export interface ScenarioInput {
  tuitionChangePct?: number;
  enrollmentChangePct?: number;
  teacherHires?: number;
  classesAdded?: number;
  classesClosed?: number;
  scholarshipChangePct?: number;
  esaChangePct?: number;
  grantChangePct?: number;
  salaryIncreasePct?: number;
  facilityExpansionCost?: number;
}

export interface ScenarioResult {
  projectedRevenue: number;
  projectedExpenses: number;
  projectedPayroll: number;
  projectedEbitda: number;
  projectedCashFlow: number;
  projectedMarginPct: number;
  deltaRevenue: number;
  deltaEbitda: number;
}

export interface ExecutiveFinancialDashboard {
  ebitda: number;
  cashPosition: number;
  revenueTrend: number | null;
  marginTrend: number | null;
  operatingMargin: number;
  contributionMargin: number;
  topPrograms: ProgramProfitabilityRow[];
  bottomPrograms: ProgramProfitabilityRow[];
  classesBelowBreakeven: number;
  classesAboveTarget: number;
  financialRisks: number;
  forecastRevenue: number | null;
  forecastPayroll: number | null;
}

export const FI_TABS = [
  { href: "/dashboard/finance/intelligence?view=overview", label: "Overview", value: "overview" },
  { href: "/dashboard/finance/intelligence?view=classes", label: "Class Profitability", value: "classes" },
  { href: "/dashboard/finance/intelligence?view=teachers", label: "Teachers", value: "teachers" },
  { href: "/dashboard/finance/intelligence?view=programs", label: "Programs", value: "programs" },
  { href: "/dashboard/finance/intelligence?view=students", label: "Student Economics", value: "students" },
  { href: "/dashboard/finance/intelligence?view=families", label: "Families", value: "families" },
  { href: "/dashboard/finance/intelligence?view=scenarios", label: "Scenarios", value: "scenarios" },
  { href: "/dashboard/finance/intelligence?view=import", label: "Import", value: "import" },
] as const;

/** AI readiness — architecture only */
export const FI_AI_CAPABILITIES = [
  "recommend_tuition_changes",
  "recommend_staffing_changes",
  "predict_enrollment",
  "predict_cash_flow",
  "predict_ebitda",
  "identify_waste",
  "optimize_schedules",
  "optimize_staffing",
  "optimize_pricing",
] as const;

export function healthFromMargin(marginPct: number, breakEvenGap?: number): FiHealthIndicator {
  if (marginPct < 0 || (breakEvenGap != null && breakEvenGap < 0)) return "red";
  if (marginPct < 10) return "yellow";
  return "green";
}
