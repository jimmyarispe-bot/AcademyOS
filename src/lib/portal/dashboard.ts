import type { createAuthClient } from "@/lib/supabase/server-auth";
import { computeStudentSuccessScore } from "@/lib/ssis/score";
import { getStudentSchedule } from "@/lib/scheduling/queries";
import { getStudentMeetings } from "@/lib/instruction/meetings";
import { getFamilyFinancialProfile } from "@/lib/finance/family-center";
import { getParentEngagementSummary } from "@/lib/ssis/engagement";
import { getPortalTasks } from "@/lib/portal/tasks";
import { getUnreadNotificationCount } from "@/lib/portal/notifications";
import { getParentDeadlines } from "@/lib/compliance/deadlines";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface PortalStudentSummary {
  id: string;
  first_name: string;
  last_name: string;
  program: string | null;
  grade_level: string | null;
  school_id: string;
  family_id: string | null;
  successScore: Awaited<ReturnType<typeof computeStudentSuccessScore>>;
  todaySessions: number;
  upcomingMeetings: number;
  attendanceAlert: boolean;
  medicalAlerts: number;
  documentsNeeded: number;
}

export async function getLinkedStudentsForPortal(supabase: AuthClient, userId: string) {
  const { data: links } = await supabase.from("student_family_link").select("student_id").eq("user_id", userId);
  const { data: guardians } = await supabase.from("guardians").select("family_id").eq("user_id", userId);
  const familyIds = guardians?.map((g) => g.family_id) ?? [];

  let familyStudents: { id: string }[] = [];
  if (familyIds.length) {
    const { data } = await supabase.from("students").select("id").in("family_id", familyIds);
    familyStudents = data ?? [];
  }

  const ids = [...new Set([...(links?.map((l) => l.student_id) ?? []), ...familyStudents.map((s) => s.id)])];
  if (!ids.length) return [];

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, program, grade_level, school_id, family_id, lifecycle_stage")
    .in("id", ids)
    .eq("lifecycle_stage", "active");

  return students ?? [];
}

export async function getParentDashboardData(supabase: AuthClient, userId: string) {
  const students = await getLinkedStudentsForPortal(supabase, userId);
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const summaries: PortalStudentSummary[] = [];
  let combinedBalance = 0;
  let combinedCredits = 0;

  for (const student of students) {
    const [score, schedule, meetings, attendanceRes, medicalRes, docsRes] = await Promise.all([
      computeStudentSuccessScore(supabase, student.id),
      getStudentSchedule(student.id),
      getStudentMeetings(supabase, student.id),
      supabase
        .from("student_attendance_records")
        .select("status")
        .eq("student_id", student.id)
        .eq("attendance_date", today),
      supabase
        .from("ssis_medical_expiry_alerts")
        .select("id")
        .eq("student_id", student.id)
        .eq("is_resolved", false),
      supabase
        .from("student_documents")
        .select("id")
        .eq("student_id", student.id)
        .eq("status", "active")
        .or("expires_at.is.null,expires_at.lt." + today),
    ]);

    const todaySessions =
      (schedule.sessions ?? []).filter((s) => {
        const d = (s as { scheduled_start?: string }).scheduled_start?.split("T")[0];
        return d === today;
      }).length +
      (schedule.services ?? []).filter((s) => {
        const d = (s as { scheduled_at?: string }).scheduled_at?.split("T")[0];
        return d === today;
      }).length;

    const upcomingMeetings = meetings.filter(
      (m) => m.parent_visible !== false && m.scheduled_at && m.scheduled_at >= new Date().toISOString()
    ).length;

    summaries.push({
      ...student,
      successScore: score,
      todaySessions,
      upcomingMeetings,
      attendanceAlert: (attendanceRes.data ?? []).some((a) => ["absent", "tardy"].includes(a.status)),
      medicalAlerts: medicalRes.data?.length ?? 0,
      documentsNeeded: docsRes.data?.length ?? 0,
    });
  }

  const familyIds = [...new Set(students.map((s) => s.family_id).filter(Boolean))] as string[];
  const financialProfiles = [];
  for (const familyId of familyIds) {
    const profile = await getFamilyFinancialProfile(supabase, familyId);
    if (profile?.account) {
      combinedBalance += Number(profile.account.balance ?? 0);
      combinedCredits += Number(profile.account.credit_balance ?? 0);
      financialProfiles.push(profile);
    }
  }

  const studentIds = students.map((s) => s.id);
  const [tasks, deadlines, unreadNotifications, engagement] = await Promise.all([
    getPortalTasks(supabase, userId, studentIds),
    getParentDeadlines(supabase, userId, studentIds),
    getUnreadNotificationCount(supabase, userId),
    students[0] ? getParentEngagementSummary(supabase, students[0].id) : Promise.resolve(null),
  ]);

  return {
    students: summaries,
    financial: { combinedBalance, combinedCredits, profiles: financialProfiles },
    tasks,
    deadlines,
    unreadNotifications,
    engagement,
    dateRange: { today, tomorrow },
  };
}

export async function getStudentPortalDetail(
  supabase: AuthClient,
  studentId: string,
  userId: string
) {
  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single();

  if (!student) return null;

  const [score, schedule, meetings, interventions, behavior, funding, scholarships] = await Promise.all([
    computeStudentSuccessScore(supabase, studentId),
    getStudentSchedule(studentId),
    getStudentMeetings(supabase, studentId),
    supabase.from("student_academic_interventions").select("*").eq("student_id", studentId).eq("status", "active"),
    supabase
      .from("student_behavior_events")
      .select("*")
      .eq("student_id", studentId)
      .order("occurred_at", { ascending: false })
      .limit(5),
    supabase.from("ssis_student_funding_records").select("*").eq("student_id", studentId),
    supabase
      .from("scholarship_applications")
      .select("id, approved_amount, scholarship_status, scholarship_type, remaining_award_balance")
      .eq("student_id", studentId)
      .eq("scholarship_status", "approved"),
  ]);

  return {
    student,
    score,
    schedule,
    meetings: meetings.filter((m) => m.parent_visible !== false),
    interventions: interventions.data ?? [],
    behavior: behavior.data ?? [],
    funding: funding.data ?? [],
    scholarships: scholarships.data ?? [],
  };
}
