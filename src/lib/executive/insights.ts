import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { getCommandCenterMetrics } from "@/lib/executive/command-center";
import { syncDetectedRisksToRegister } from "@/lib/executive/risk-intelligence";
import type { StrategicGoal } from "@/lib/executive/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function generateExecutiveInsights(supabase: AuthClient, schoolId?: string) {
  const metrics = await getCommandCenterMetrics(supabase, schoolId);
  const insights: {
    school_id: string | null;
    insight_type: string;
    severity: string;
    title: string;
    body: string;
    metric_key: string | null;
    metric_value: number | null;
    comparison_value: number | null;
    recommended_action: string | null;
    href: string | null;
  }[] = [];

  if (metrics.enrollmentTrendPct != null && metrics.enrollmentTrendPct >= 5) {
    insights.push({
      school_id: schoolId ?? null,
      insight_type: "trend",
      severity: "info",
      title: "Enrollment trending up",
      body: `Enrollment has increased ${metrics.enrollmentTrendPct}% compared to the prior period.`,
      metric_key: "enrollment_growth",
      metric_value: metrics.enrollmentTrendPct,
      comparison_value: 5,
      recommended_action: "Review capacity planning and staffing forecasts",
      href: "/dashboard/executive/network",
    });
  }

  if (metrics.enrollmentTrendPct != null && metrics.enrollmentTrendPct < 0) {
    insights.push({
      school_id: schoolId ?? null,
      insight_type: "trend",
      severity: "warning",
      title: "Enrollment declining",
      body: `Enrollment has decreased ${Math.abs(metrics.enrollmentTrendPct)}% compared to the prior period.`,
      metric_key: "enrollment_growth",
      metric_value: metrics.enrollmentTrendPct,
      comparison_value: 0,
      recommended_action: "Review admissions pipeline and retention initiatives",
      href: "/dashboard/admissions?view=executive",
    });
  }

  if (metrics.attendanceRate != null && metrics.attendanceRate < 90) {
    insights.push({
      school_id: schoolId ?? null,
      insight_type: "threshold",
      severity: "warning",
      title: "Attendance below target",
      body: `Network attendance rate is ${metrics.attendanceRate}% — below the 90% target.`,
      metric_key: "attendance_rate",
      metric_value: metrics.attendanceRate,
      comparison_value: 90,
      recommended_action: "Review campus-level attendance patterns",
      href: "/dashboard/students",
    });
  }

  if (metrics.accountsReceivable > 0 && metrics.revenue > 0) {
    const arPct = Math.round((metrics.accountsReceivable / (metrics.revenue + metrics.accountsReceivable)) * 100);
    if (arPct > 20) {
      insights.push({
        school_id: schoolId ?? null,
        insight_type: "risk",
        severity: "warning",
        title: "Elevated accounts receivable",
        body: `Outstanding AR represents ${arPct}% of billed revenue.`,
        metric_key: "collection_rate",
        metric_value: arPct,
        comparison_value: 20,
        recommended_action: "Review collections workflow and payment plans",
        href: "/dashboard/finance/executive",
      });
    }
  }

  if (metrics.complianceAlerts > 0) {
    insights.push({
      school_id: schoolId ?? null,
      insight_type: "threshold",
      severity: "critical",
      title: "Compliance items require attention",
      body: `${metrics.complianceAlerts} compliance requirements are pending or overdue.`,
      metric_key: null,
      metric_value: metrics.complianceAlerts,
      comparison_value: 0,
      recommended_action: "Review Enterprise Compliance Center",
      href: "/dashboard/compliance",
    });
  }

  if (metrics.missionControlCritical > 0) {
    insights.push({
      school_id: schoolId ?? null,
      insight_type: "recommendation",
      severity: "critical",
      title: "Overdue Mission Control tasks",
      body: `${metrics.missionControlCritical} overdue operational tasks need executive attention.`,
      metric_key: null,
      metric_value: metrics.missionControlCritical,
      comparison_value: 0,
      recommended_action: "Review Mission Control feed",
      href: "/dashboard/mission-control",
    });
  }

  for (const insight of insights) {
    const { data: existing } = await supabase
      .from("executive_insights")
      .select("id")
      .eq("title", insight.title)
      .eq("is_dismissed", false)
      .maybeSingle();

    if (existing) continue;

    const { data: inserted } = await supabase
      .from("executive_insights")
      .insert(insight)
      .select("id")
      .single();

    if (inserted && insight.severity === "critical" && schoolId) {
      await createMissionControlItem(supabase, {
        schoolId,
        module: "executive",
        itemType: "executive_alert",
        title: insight.title,
        body: insight.body,
        href: insight.href ?? "/dashboard/executive",
        entityType: "executive_insights",
        entityId: inserted.id,
        assignedRole: "CEO",
        severity: "high",
      });
    }
  }

  await syncDetectedRisksToRegister(supabase, schoolId);
}

export async function getStrategicPlanningWorkspace(supabase: AuthClient, schoolId?: string) {
  let goalsQuery = supabase
    .from("executive_strategic_goals")
    .select("*, executive_strategic_initiatives(id, title, status, progress_pct)")
    .in("status", ["active", "draft"])
    .order("target_date");

  if (schoolId) goalsQuery = goalsQuery.eq("school_id", schoolId);
  const { data } = await goalsQuery;

  return (data ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    goal_type: g.goal_type,
    status: g.status,
    progress_pct: Number(g.progress_pct),
    target_date: g.target_date,
    linked_kpi_key: g.linked_kpi_key,
    initiatives: (g.executive_strategic_initiatives ?? []) as StrategicGoal["initiatives"],
  })) as StrategicGoal[];
}

export async function getComplianceCenter(supabase: AuthClient, schoolId?: string) {
  let query = supabase
    .from("executive_compliance_requirements")
    .select("*")
    .order("due_date");

  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}

export async function getGrantsDashboard(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("executive_grants").select("*").order("reporting_deadline");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;

  const grants = data ?? [];
  const awarded = grants.filter((g) => ["awarded", "active", "reporting"].includes(g.pipeline_stage));
  const pipeline = grants.filter((g) => ["prospect", "applied"].includes(g.pipeline_stage));

  return {
    grants,
    totalAwarded: awarded.reduce((s, g) => s + Number(g.award_amount ?? 0), 0),
    totalSpent: awarded.reduce((s, g) => s + Number(g.spent_amount ?? 0), 0),
    pipelineCount: pipeline.length,
    upcomingDeadlines: grants.filter(
      (g) => g.reporting_deadline && g.reporting_deadline <= new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0]
    ),
  };
}

export async function getReportTemplates(supabase: AuthClient, schoolId?: string) {
  let query = supabase.from("executive_report_templates").select("*").eq("is_active", true);
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query;
  return data ?? [];
}
