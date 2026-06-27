import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { ExecutiveScorecard } from "@/lib/edi/types";
import { getCommandCenterMetrics } from "@/lib/executive/command-center";
import { getExecutiveFinancialDashboard } from "@/lib/financial-intelligence/executive";
import { computeCapacitySnapshot } from "@/lib/edi/capacity-planning";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function computeExecutiveScorecard(
  supabase: AuthClient,
  schoolId: string
): Promise<ExecutiveScorecard> {
  const [metrics, fi, capacity] = await Promise.all([
    getCommandCenterMetrics(supabase, schoolId),
    getExecutiveFinancialDashboard(supabase, schoolId),
    computeCapacitySnapshot(supabase, schoolId),
  ]);

  const financialHealth = clamp(fi.operatingMargin + 50);
  const enrollmentHealth = clamp((metrics.enrollmentTrendPct ?? 0) + 70);
  const studentSuccess = clamp((metrics.avgSuccessScore ?? 70));
  const teacherEffectiveness = clamp(100 - (capacity.teacherUtilizationPct > 90 ? 20 : 0));
  const compliance = clamp(100 - metrics.complianceAlerts * 5);
  const growth = clamp((metrics.enrollmentTrendPct ?? 0) + 60);
  const parentEngagement = clamp((metrics.interventionEffectiveness ?? 70));
  const operationalEfficiency = clamp(capacity.scheduleUtilizationPct);
  const capacityScore = clamp(100 - Math.abs(capacity.scheduleUtilizationPct - 85));
  const risk = clamp(100 - fi.financialRisks * 8 - metrics.missionControlCritical * 3);

  const dimensions = [financialHealth, enrollmentHealth, studentSuccess, teacherEffectiveness, compliance, growth, parentEngagement, operationalEfficiency, capacityScore, risk];
  const overallEnterpriseHealth = Math.round(dimensions.reduce((s, d) => s + d, 0) / dimensions.length);

  const scorecard: ExecutiveScorecard = {
    financialHealth,
    enrollmentHealth,
    studentSuccess,
    teacherEffectiveness,
    compliance,
    growth,
    parentEngagement,
    operationalEfficiency,
    capacity: capacityScore,
    risk,
    overallEnterpriseHealth,
  };

  const today = new Date().toISOString().split("T")[0];
  await supabase.from("edi_scorecard_snapshots").upsert(
    {
      school_id: schoolId,
      snapshot_date: today,
      financial_health: scorecard.financialHealth,
      enrollment_health: scorecard.enrollmentHealth,
      student_success: scorecard.studentSuccess,
      teacher_effectiveness: scorecard.teacherEffectiveness,
      compliance: scorecard.compliance,
      growth: scorecard.growth,
      parent_engagement: scorecard.parentEngagement,
      operational_efficiency: scorecard.operationalEfficiency,
      capacity: scorecard.capacity,
      risk: scorecard.risk,
      overall_enterprise_health: scorecard.overallEnterpriseHealth,
      dimensions: { metrics, fi_summary: { ebitda: fi.ebitda, classes_below_breakeven: fi.classesBelowBreakeven } },
    },
    { onConflict: "school_id,snapshot_date" }
  );

  return scorecard;
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function getLatestScorecard(supabase: AuthClient, schoolId: string) {
  const { data } = await supabase
    .from("edi_scorecard_snapshots")
    .select("*")
    .eq("school_id", schoolId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return computeExecutiveScorecard(supabase, schoolId);

  return {
    financialHealth: Number(data.financial_health),
    enrollmentHealth: Number(data.enrollment_health),
    studentSuccess: Number(data.student_success),
    teacherEffectiveness: Number(data.teacher_effectiveness),
    compliance: Number(data.compliance),
    growth: Number(data.growth),
    parentEngagement: Number(data.parent_engagement),
    operationalEfficiency: Number(data.operational_efficiency),
    capacity: Number(data.capacity),
    risk: Number(data.risk),
    overallEnterpriseHealth: Number(data.overall_enterprise_health),
  } satisfies ExecutiveScorecard;
}
