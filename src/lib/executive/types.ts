export interface ExecutiveWidget {
  id: string;
  label: string;
  category: string;
  enabled: boolean;
}

export const DEFAULT_EXECUTIVE_WIDGETS: ExecutiveWidget[] = [
  { id: "enrollment", label: "Enrollment", category: "enrollment", enabled: true },
  { id: "enrollment_trend", label: "Enrollment Trends", category: "enrollment", enabled: true },
  { id: "admissions_pipeline", label: "Admissions Pipeline", category: "admissions", enabled: true },
  { id: "revenue", label: "Revenue", category: "financial", enabled: true },
  { id: "cash_flow", label: "Cash Flow", category: "financial", enabled: true },
  { id: "accounts_receivable", label: "Accounts Receivable", category: "financial", enabled: true },
  { id: "scholarships", label: "Scholarships", category: "financial", enabled: true },
  { id: "state_funding", label: "State Funding", category: "financial", enabled: true },
  { id: "success_scores", label: "Student Success Scores", category: "academic", enabled: true },
  { id: "attendance", label: "Attendance", category: "academic", enabled: true },
  { id: "academic_growth", label: "Academic Growth", category: "academic", enabled: true },
  { id: "intervention_effectiveness", label: "Intervention Effectiveness", category: "academic", enabled: true },
  { id: "staffing", label: "Staffing Levels", category: "workforce", enabled: true },
  { id: "payroll", label: "Payroll", category: "workforce", enabled: true },
  { id: "compliance_alerts", label: "Compliance Alerts", category: "compliance", enabled: true },
  { id: "mission_control", label: "Mission Control Summary", category: "operations", enabled: true },
  { id: "insights", label: "Executive Insights", category: "intelligence", enabled: true },
  { id: "risk_summary", label: "Risk Summary", category: "intelligence", enabled: true },
];

export interface CommandCenterMetrics {
  enrollment: number;
  enrollmentTrendPct: number | null;
  admissionsPipeline: number;
  revenue: number;
  cashFlow: number;
  accountsReceivable: number;
  scholarships: number;
  stateFunding: number;
  avgSuccessScore: number | null;
  attendanceRate: number | null;
  academicGrowthPct: number | null;
  interventionEffectiveness: number | null;
  staffingLevels: number;
  payrollYtd: number;
  complianceAlerts: number;
  missionControlOpen: number;
  missionControlCritical: number;
}

export interface ExecutiveInsight {
  id: string;
  title: string;
  body: string;
  severity: string;
  insight_type: string;
  recommended_action: string | null;
  href: string | null;
  metric_key: string | null;
  metric_value: number | null;
}

export interface NetworkDimensionRow {
  dimension: string;
  dimensionValue: string;
  enrollment: number;
  revenue: number;
  outstandingAr: number;
  avgSuccessScore: number | null;
  activeStaff: number;
  pipelineLeads: number;
  drillHref: string | null;
}

export interface KpiRow {
  kpi_key: string;
  display_name: string;
  category: string;
  unit: string;
  actual_value: number | null;
  target_value: number | null;
  prior_value: number | null;
  trend_pct: number | null;
  status: "on_track" | "warning" | "critical" | "unknown";
}

export interface RiskItem {
  id: string;
  risk_category: string;
  title: string;
  description: string | null;
  risk_score: number;
  likelihood: string;
  impact: string;
  status: string;
  recommended_action: string | null;
  due_date: string | null;
}

export interface StrategicGoal {
  id: string;
  title: string;
  description: string | null;
  goal_type: string;
  status: string;
  progress_pct: number;
  target_date: string | null;
  linked_kpi_key: string | null;
  initiatives: { id: string; title: string; status: string; progress_pct: number }[];
}

export interface ForecastScenario {
  id: string;
  scenario_name: string;
  scenario_type: string;
  forecast_enrollment: number | null;
  forecast_tuition: number | null;
  forecast_scholarships: number | null;
  forecast_state_funding: number | null;
  forecast_payroll: number | null;
  assumptions: Record<string, unknown>;
}
