import { createAuthClient } from "@/lib/supabase/server-auth";

export interface StudentDashboardSummary {
  attendanceRate: number;
  absencesThisMonth: number;
  tardiesThisMonth: number;
  positiveBehaviorCount: number;
  incidentCount: number;
  activeServicesCount: number;
  upcomingMeetings: { title: string; date: string; href?: string }[];
  medicalAlertCount: number;
  documentCount: number;
  spedReviewDue: boolean;
}

export interface StudentConversionLink {
  id: string;
  application_id: string;
  lead_id: string;
  converted_at: string;
  conversion_source: string;
  snapshot: Record<string, unknown>;
}

export async function getStudentConversion(studentId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("sis_admissions_conversions")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  return data as StudentConversionLink | null;
}

export async function getStudentDashboardSummary(studentId: string): Promise<StudentDashboardSummary> {
  const supabase = await createAuthClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  const [
    attendanceRes,
    behaviorRes,
    servicesRes,
    medicalRes,
    documentsRes,
    spedRes,
  ] = await Promise.all([
    supabase
      .from("student_attendance_records")
      .select("status")
      .eq("student_id", studentId)
      .gte("attendance_date", monthStartStr),
    supabase
      .from("student_behavior_events")
      .select("event_type")
      .eq("student_id", studentId)
      .gte("occurred_at", monthStart.toISOString()),
    supabase
      .from("student_service_sessions")
      .select("id")
      .eq("student_id", studentId)
      .eq("session_status", "scheduled")
      .gte("scheduled_at", new Date().toISOString()),
    supabase
      .from("student_medical_profiles")
      .select("health_alerts, allergies")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_documents")
      .select("id")
      .eq("student_id", studentId)
      .eq("status", "active"),
    supabase
      .from("student_special_education_plans")
      .select("annual_review_date, reevaluation_date")
      .eq("student_id", studentId)
      .eq("status", "active"),
  ]);

  const attendance = attendanceRes.data ?? [];
  const presentCount = attendance.filter((a) =>
    ["present", "virtual_present", "therapy_present"].includes(a.status)
  ).length;
  const totalDays = attendance.length || 1;

  const behavior = behaviorRes.data ?? [];
  const medical = medicalRes.data;
  const alerts = Array.isArray(medical?.health_alerts) ? medical.health_alerts.length : 0;
  const allergies = Array.isArray(medical?.allergies) ? medical.allergies.length : 0;

  const spedPlans = spedRes.data ?? [];
  const today = new Date();
  const spedReviewDue = spedPlans.some((p) => {
    const dates = [p.annual_review_date, p.reevaluation_date].filter(Boolean) as string[];
    return dates.some((d) => {
      const due = new Date(d);
      const diff = (due.getTime() - today.getTime()) / 86400000;
      return diff >= 0 && diff <= 30;
    });
  });

  return {
    attendanceRate: Math.round((presentCount / totalDays) * 100),
    absencesThisMonth: attendance.filter((a) =>
      a.status.startsWith("absent")
    ).length,
    tardiesThisMonth: attendance.filter((a) => a.status === "tardy").length,
    positiveBehaviorCount: behavior.filter((b) => b.event_type === "positive").length,
    incidentCount: behavior.filter((b) => b.event_type === "incident").length,
    activeServicesCount: servicesRes.data?.length ?? 0,
    upcomingMeetings: [],
    medicalAlertCount: alerts + allergies,
    documentCount: documentsRes.data?.length ?? 0,
    spedReviewDue,
  };
}

export async function getStudentMedicalProfile(studentId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("student_medical_profiles")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  return data;
}

export async function getStudentSpedPlans(studentId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("student_special_education_plans")
    .select("*, student_special_education_goals(*)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getStudentAcademicProfile(studentId: string) {
  const supabase = await createAuthClient();
  const [profile, assessments, goals, interventions] = await Promise.all([
    supabase.from("student_learning_profiles").select("*").eq("student_id", studentId).maybeSingle(),
    supabase
      .from("student_academic_assessments")
      .select("*")
      .eq("student_id", studentId)
      .order("assessed_on", { ascending: false })
      .limit(20),
    supabase.from("student_academic_goals").select("*").eq("student_id", studentId),
    supabase.from("student_academic_interventions").select("*").eq("student_id", studentId),
  ]);
  return {
    profile: profile.data,
    assessments: assessments.data ?? [],
    goals: goals.data ?? [],
    interventions: interventions.data ?? [],
  };
}

export async function getStudentAttendance(studentId: string, limit = 30) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("student_attendance_records")
    .select("*")
    .eq("student_id", studentId)
    .order("attendance_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getStudentBehavior(studentId: string, limit = 20) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("student_behavior_events")
    .select("*")
    .eq("student_id", studentId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getStudentServices(studentId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("student_service_sessions")
    .select("*")
    .eq("student_id", studentId)
    .order("scheduled_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function getStudentDocuments(studentId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("student_documents")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getStudentAuthorizedContacts(studentId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("student_authorized_contacts")
    .select("*")
    .eq("student_id", studentId)
    .eq("is_active", true);
  return data ?? [];
}
