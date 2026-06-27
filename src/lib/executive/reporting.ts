import type { createAuthClient } from "@/lib/supabase/server-auth";
import { buildFinanceBoardExport } from "@/lib/finance/export";
import { getCommandCenterMetrics } from "@/lib/executive/command-center";
import { getKpiCenter } from "@/lib/executive/kpi-center";
import { getWorkforceAnalytics } from "@/lib/hr/analytics";
import { getExecutiveInstructionDashboard } from "@/lib/instruction/executive";
import { getExecutiveAdmissionsMetrics } from "@/lib/admissions/executive-metrics";
import { getRiskRegister } from "@/lib/executive/risk-intelligence";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Multi-module board-ready export — reuses finance export + executive rollups */
export async function buildExecutiveBoardExport(
  supabase: AuthClient,
  schoolId: string,
  dateFrom: string,
  dateTo: string
) {
  const [financeCsv, metrics, kpis, workforce, instruction, admissions, risks] = await Promise.all([
    buildFinanceBoardExport(supabase, schoolId, dateFrom, dateTo),
    getCommandCenterMetrics(supabase, schoolId),
    getKpiCenter(supabase, schoolId),
    getWorkforceAnalytics(supabase, schoolId),
    getExecutiveInstructionDashboard(supabase, schoolId),
    getExecutiveAdmissionsMetrics(),
    getRiskRegister(supabase, schoolId),
  ]);

  const executiveSummary = [
    ["section", "metric", "value"],
    ["enrollment", "total_enrollment", metrics.enrollment],
    ["enrollment", "enrollment_trend_pct", metrics.enrollmentTrendPct ?? ""],
    ["admissions", "pipeline_leads", metrics.admissionsPipeline],
    ["admissions", "acceptance_rate", admissions.acceptanceRate ?? ""],
    ["financial", "revenue_collected", metrics.revenue],
    ["financial", "outstanding_ar", metrics.accountsReceivable],
    ["financial", "scholarships", metrics.scholarships],
    ["financial", "state_funding", metrics.stateFunding],
    ["academic", "avg_success_score", metrics.avgSuccessScore ?? ""],
    ["academic", "attendance_rate", metrics.attendanceRate ?? ""],
    ["academic", "intervention_effectiveness", metrics.interventionEffectiveness ?? ""],
    ["workforce", "active_staff", workforce.staffingLevels],
    ["workforce", "payroll_ytd", workforce.payrollCostsYtd],
    ["workforce", "turnover_rate", workforce.turnoverRate],
    ["operations", "mission_control_open", metrics.missionControlOpen],
    ["operations", "compliance_alerts", metrics.complianceAlerts],
  ];

  const kpiRows = [
    ["kpi_key", "display_name", "actual", "target", "status"],
    ...kpis.map((k) => [k.kpi_key, k.display_name, k.actual_value ?? "", k.target_value ?? "", k.status]),
  ];

  const riskRows = [
    ["category", "title", "score", "likelihood", "impact", "recommended_action"],
    ...risks.slice(0, 20).map((r) => [
      r.risk_category,
      r.title,
      r.risk_score,
      r.likelihood,
      r.impact,
      r.recommended_action ?? "",
    ]),
  ];

  const instructionRows = [
    ["metric", "value"],
    ["active_teachers", instruction.activeTeachers],
    ["sessions_this_month", instruction.sessionsThisMonth],
    ["instructional_hours", instruction.instructionalHours],
    ["avg_goal_progress", instruction.avgGoalProgress],
    ["goals_at_risk", instruction.goalsAtRisk],
    ["completion_rate", instruction.completionRate],
  ];

  const sections = [
    "# AcademyOS Executive Board Report",
    `# School: ${schoolId}`,
    `# Period: ${dateFrom} to ${dateTo}`,
    `# Generated: ${new Date().toISOString()}`,
    "",
    "# Executive Summary",
    executiveSummary.map((r) => r.map(csvEscape).join(",")).join("\n"),
    "",
    "# Strategic KPIs",
    kpiRows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    "",
    "# Risk Indicators",
    riskRows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    "",
    "# Instructional Outcomes",
    instructionRows.map((r) => r.map(csvEscape).join(",")).join("\n"),
    "",
    "# Financial Detail (from Finance Operations)",
    financeCsv,
  ];

  return sections.join("\n");
}
