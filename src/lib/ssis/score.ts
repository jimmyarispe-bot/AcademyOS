import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export type SuccessIndicator = "green" | "yellow" | "red";

export interface SuccessScoreResult {
  overallScore: number;
  statusIndicator: SuccessIndicator;
  componentScores: Record<string, number>;
  computedAt: string;
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  attendance: 20,
  academic_growth: 20,
  behavior: 15,
  intervention_progress: 10,
  parent_engagement: 10,
  funding_status: 10,
  missing_documents: 10,
  compliance: 5,
};

function indicatorForScore(
  score: number,
  green: number,
  yellow: number
): SuccessIndicator {
  if (score >= green) return "green";
  if (score >= yellow) return "yellow";
  return "red";
}

export async function computeStudentSuccessScore(
  supabase: AuthClient,
  studentId: string
): Promise<SuccessScoreResult | null> {
  const { data: student } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", studentId)
    .single();

  if (!student) return null;

  const { data: config } = await supabase
    .from("ssis_success_score_config")
    .select("weights, green_threshold, yellow_threshold")
    .eq("school_id", student.school_id)
    .maybeSingle();

  const weights = { ...DEFAULT_WEIGHTS, ...(config?.weights as Record<string, number> ?? {}) };
  const greenThreshold = Number(config?.green_threshold ?? 80);
  const yellowThreshold = Number(config?.yellow_threshold ?? 60);

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  const [
    attendanceRes,
    assessmentsRes,
    behaviorRes,
    interventionsRes,
    engagementRes,
    fundingRes,
    documentsRes,
    spedRes,
    servicesRes,
  ] = await Promise.all([
    supabase.from("student_attendance_records").select("status").eq("student_id", studentId).gte("attendance_date", monthStartStr),
    supabase.from("student_academic_assessments").select("id").eq("student_id", studentId).gte("assessed_on", monthStartStr),
    supabase.from("student_behavior_events").select("event_type").eq("student_id", studentId).gte("occurred_at", monthStart.toISOString()),
    supabase.from("student_academic_interventions").select("status").eq("student_id", studentId).eq("status", "active"),
    supabase.from("ssis_parent_engagement_events").select("engagement_score").eq("student_id", studentId).gte("occurred_at", monthStart.toISOString()),
    supabase.from("ssis_student_funding_records").select("verification_status, payment_status").eq("student_id", studentId),
    supabase.from("student_documents").select("id, expires_at").eq("student_id", studentId).eq("status", "active"),
    supabase.from("student_special_education_plans").select("annual_review_date, reevaluation_date").eq("student_id", studentId).eq("status", "active"),
    supabase.from("student_service_sessions").select("session_status").eq("student_id", studentId).gte("scheduled_at", monthStart.toISOString()),
  ]);

  const attendance = attendanceRes.data ?? [];
  const present = attendance.filter((a) =>
    ["present", "virtual_present", "therapy_present"].includes(a.status)
  ).length;
  const attendanceScore = attendance.length ? (present / attendance.length) * 100 : 85;

  const assessmentCount = assessmentsRes.data?.length ?? 0;
  const academicScore = Math.min(100, 50 + assessmentCount * 10);

  const behavior = behaviorRes.data ?? [];
  const incidents = behavior.filter((b) => b.event_type === "incident").length;
  const positive = behavior.filter((b) => b.event_type === "positive").length;
  const behaviorScore = Math.max(0, Math.min(100, 90 - incidents * 15 + positive * 5));

  const activeInterventions = interventionsRes.data?.length ?? 0;
  const interventionScore = activeInterventions > 0 ? 75 : 90;

  const engagement = engagementRes.data ?? [];
  const engagementSum = engagement.reduce((s, e) => s + (e.engagement_score ?? 0), 0);
  const parentScore = Math.max(0, Math.min(100, 70 + engagementSum * 3));

  const funding = fundingRes.data ?? [];
  const verifiedFunding = funding.filter((f) => f.verification_status === "verified").length;
  const fundingScore = funding.length ? (verifiedFunding / funding.length) * 100 : 80;

  const docs = documentsRes.data ?? [];
  const today = new Date();
  const expiredDocs = docs.filter(
    (d) => d.expires_at && new Date(d.expires_at as string) < today
  ).length;
  const missingDocsScore = Math.max(0, 100 - expiredDocs * 20);

  const spedPlans = spedRes.data ?? [];
  const overdueSped = spedPlans.some((p) => {
    const dates = [p.annual_review_date, p.reevaluation_date].filter(Boolean) as string[];
    return dates.some((d) => new Date(d) < today);
  });
  const services = servicesRes.data ?? [];
  const missedServices = services.filter((s) => s.session_status === "missed").length;
  const complianceScore = overdueSped ? 50 : missedServices > 2 ? 65 : 95;

  const componentScores: Record<string, number> = {
    attendance: Math.round(attendanceScore),
    academic_growth: Math.round(academicScore),
    behavior: Math.round(behaviorScore),
    intervention_progress: Math.round(interventionScore),
    parent_engagement: Math.round(parentScore),
    funding_status: Math.round(fundingScore),
    missing_documents: Math.round(missingDocsScore),
    compliance: Math.round(complianceScore),
  };

  let weightedSum = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (componentScores[key] !== undefined) {
      weightedSum += componentScores[key] * weight;
      weightTotal += weight;
    }
  }

  const overallScore = weightTotal ? Math.round((weightedSum / weightTotal) * 100) / 100 : 0;
  const statusIndicator = indicatorForScore(overallScore, greenThreshold, yellowThreshold);
  const computedAt = new Date().toISOString();

  await supabase.from("ssis_student_success_scores").insert({
    student_id: studentId,
    overall_score: overallScore,
    status_indicator: statusIndicator,
    component_scores: componentScores,
    computed_at: computedAt,
    config_snapshot: { weights, greenThreshold, yellowThreshold },
  });

  return { overallScore, statusIndicator, componentScores, computedAt };
}

export async function getLatestStudentSuccessScore(
  supabase: AuthClient,
  studentId: string
): Promise<SuccessScoreResult | null> {
  const { data } = await supabase
    .from("ssis_student_success_scores")
    .select("overall_score, status_indicator, component_scores, computed_at")
    .eq("student_id", studentId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return computeStudentSuccessScore(supabase, studentId);
  }

  return {
    overallScore: Number(data.overall_score),
    statusIndicator: data.status_indicator as SuccessIndicator,
    componentScores: data.component_scores as Record<string, number>,
    computedAt: data.computed_at,
  };
}
