"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getTeacherEmployeeId } from "@/lib/teacher/queries";
import { writePlatformAudit } from "@/lib/platform/automation/audit";
import { ensureInstructionalTeam, updateGrowthGoalProgress } from "@/lib/instruction/growth-plan";
import { recordSessionOutcome } from "@/lib/instruction/outcomes";
import { completeInstructionalMeeting, createInstructionalMeeting } from "@/lib/instruction/meetings";
import { recordInterventionEffectiveness } from "@/lib/instruction/effectiveness";
import { publishCollaborationFeedEvent } from "@/lib/instruction/feed";
import { enqueueGrowthGoalReviewReminder } from "@/lib/instruction/automation";

async function requireInstructionPermission(permission: string) {
  const ctx = await getIdentityContext();
  if (
    !ctx?.permissions.includes(permission) &&
    !ctx?.permissions.includes("teacher.manage") &&
    !ctx?.isEnterpriseAdmin
  ) {
    return { error: "Permission denied" as const, ctx: null };
  }
  return { ctx, error: null };
}

export async function addTeamMemberAction(formData: FormData) {
  const { ctx, error } = await requireInstructionPermission("instruction.team");
  if (error || !ctx) return { error: error ?? "Unauthorized" };

  const supabase = await createAuthClient();
  const studentId = formData.get("student_id") as string;
  const employeeId = formData.get("employee_id") as string;
  const teamRole = formData.get("team_role") as string;

  const { data: student } = await supabase.from("students").select("school_id").eq("id", studentId).single();
  if (!student) return { error: "Student not found" };

  const teamId = await ensureInstructionalTeam(supabase, studentId, student.school_id);

  const { error: insertError } = await supabase.from("student_instructional_team_members").insert({
    team_id: teamId,
    employee_id: employeeId,
    team_role: teamRole,
    is_primary: formData.get("is_primary") === "true",
  });

  if (insertError) return { error: insertError.message };

  await publishCollaborationFeedEvent(supabase, {
    studentId,
    schoolId: student.school_id,
    actorUserId: ctx.effectiveUserId,
    eventType: "team_member_added",
    title: `Team member added (${teamRole.replace(/_/g, " ")})`,
  });

  revalidatePath(`/dashboard/teacher/students/${studentId}`);
  return { success: true };
}

export async function updateGrowthGoalAction(formData: FormData) {
  const { ctx, error } = await requireInstructionPermission("instruction.growth_plan");
  if (error || !ctx) return { error: error ?? "Unauthorized" };

  const supabase = await createAuthClient();
  const employeeId = await getTeacherEmployeeId(supabase, ctx.effectiveUserId);

  await updateGrowthGoalProgress(supabase, {
    goalId: formData.get("goal_id") as string,
    studentId: formData.get("student_id") as string,
    progressPct: Number(formData.get("progress_pct")),
    progressNotes: (formData.get("progress_notes") as string) || undefined,
    evidence: (formData.get("evidence_note") as string)
      ? [{ note: formData.get("evidence_note") as string, recorded_at: new Date().toISOString() }]
      : undefined,
    actorUserId: ctx.effectiveUserId,
    actorEmployeeId: employeeId ?? undefined,
  });

  revalidatePath(`/dashboard/teacher/students/${formData.get("student_id")}`);
  return { success: true };
}

export async function recordSessionOutcomeAction(formData: FormData) {
  const { ctx, error } = await requireInstructionPermission("teacher.manage");
  if (error || !ctx) return { error: error ?? "Unauthorized" };

  const supabase = await createAuthClient();
  const employeeId = await getTeacherEmployeeId(supabase, ctx.effectiveUserId);
  const sessionId = formData.get("session_id") as string;
  const studentId = (formData.get("student_id") as string) || null;

  const skills = (formData.get("skills_addressed") as string) || "";
  const objectives = (formData.get("learning_objectives") as string) || "";
  const evidenceLines = ((formData.get("evidence_collected") as string) || "").split("\n").map((s) => s.trim()).filter(Boolean);

  await recordSessionOutcome(supabase, {
    sessionId,
    studentId,
    skillsAddressed: skills.split("\n").map((s) => s.trim()).filter(Boolean),
    learningObjectives: objectives.split("\n").map((s) => s.trim()).filter(Boolean),
    studentResponse: (formData.get("student_response") as string) || undefined,
    masteryLevel: (formData.get("mastery_level") as string) || undefined,
    evidenceCollected: evidenceLines,
    recommendedNextSteps: (formData.get("recommended_next_steps") as string) || undefined,
    homeworkPractice: (formData.get("homework_practice") as string) || undefined,
    followUpTasks: ((formData.get("follow_up_tasks") as string) || "").split("\n").filter(Boolean),
    growthGoalId: (formData.get("growth_goal_id") as string) || null,
    recordedBy: ctx.effectiveUserId,
    actorEmployeeId: employeeId ?? undefined,
  });

  revalidatePath(`/dashboard/teacher/sessions/${sessionId}`);
  return { success: true };
}

export async function scheduleMeetingAction(formData: FormData) {
  const { ctx, error } = await requireInstructionPermission("instruction.meetings");
  if (error || !ctx) return { error: error ?? "Unauthorized" };

  const supabase = await createAuthClient();
  const employeeId = await getTeacherEmployeeId(supabase, ctx.effectiveUserId);
  const studentId = formData.get("student_id") as string;
  const { data: student } = await supabase.from("students").select("school_id").eq("id", studentId).single();
  if (!student) return { error: "Student not found" };

  await createInstructionalMeeting(supabase, {
    studentId,
    schoolId: student.school_id,
    meetingType: formData.get("meeting_type") as string,
    title: formData.get("title") as string,
    scheduledAt: (formData.get("scheduled_at") as string) || undefined,
    agenda: (formData.get("agenda") as string) || undefined,
    createdBy: ctx.effectiveUserId,
    actorEmployeeId: employeeId,
  });

  revalidatePath("/dashboard/teacher");
  revalidatePath(`/dashboard/teacher/students/${studentId}`);
  return { success: true };
}

export async function recordInterventionEffectivenessAction(formData: FormData) {
  const { ctx, error } = await requireInstructionPermission("instruction.growth_plan");
  if (error || !ctx) return { error: error ?? "Unauthorized" };

  const supabase = await createAuthClient();
  await recordInterventionEffectiveness(supabase, {
    interventionId: formData.get("intervention_id") as string,
    studentId: formData.get("student_id") as string,
    minutesDelivered: Number(formData.get("minutes_delivered") || 0),
    sessionsDelivered: formData.get("sessions_delivered") ? Number(formData.get("sessions_delivered")) : undefined,
    progressScore: formData.get("progress_score") ? Number(formData.get("progress_score")) : undefined,
    progressTrend: (formData.get("progress_trend") as string) || undefined,
    effectivenessRating: (formData.get("effectiveness_rating") as string) || undefined,
    outcomeNotes: (formData.get("outcome_notes") as string) || undefined,
    periodStart: (formData.get("period_start") as string) || undefined,
    periodEnd: (formData.get("period_end") as string) || undefined,
    recordedBy: ctx.effectiveUserId,
  });

  await writePlatformAudit(supabase, {
    module: "teacher_portal",
    entityType: "student_academic_interventions",
    entityId: formData.get("intervention_id") as string,
    actionType: "effectiveness_recorded",
    summary: "Intervention effectiveness snapshot",
    actorUserId: ctx.effectiveUserId,
  });

  revalidatePath(`/dashboard/teacher/students/${formData.get("student_id")}`);
  return { success: true };
}

export async function createGrowthGoalAction(formData: FormData) {
  const { ctx, error } = await requireInstructionPermission("instruction.growth_plan");
  if (error || !ctx) return { error: error ?? "Unauthorized" };

  const supabase = await createAuthClient();
  const employeeId = await getTeacherEmployeeId(supabase, ctx.effectiveUserId);

  const { error: insertError, data: created } = await supabase.from("student_growth_goals").insert({
    student_id: formData.get("student_id") as string,
    goal_source: formData.get("goal_source") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    baseline: (formData.get("baseline") as string) || null,
    target: (formData.get("target") as string) || null,
    success_criteria: (formData.get("success_criteria") as string) || null,
    review_date: (formData.get("review_date") as string) || null,
    assigned_employee_id: employeeId,
    subject_domain: (formData.get("subject_domain") as string) || null,
  }).select("id, review_date, title, student_id, students(school_id)").single();

  if (insertError) return { error: insertError.message };

  if (created?.review_date) {
    const st = Array.isArray(created.students) ? created.students[0] : created.students;
    const schoolId = (st as { school_id?: string })?.school_id;
    if (schoolId) {
      await enqueueGrowthGoalReviewReminder(supabase, {
        goalId: created.id,
        studentId: created.student_id,
        schoolId,
        reviewDate: created.review_date,
        title: created.title,
      });
    }
  }

  revalidatePath(`/dashboard/teacher/students/${formData.get("student_id")}`);
  return { success: true };
}

export async function completeMeetingAction(formData: FormData) {
  const { ctx, error } = await requireInstructionPermission("instruction.meetings");
  if (error || !ctx) return { error: error ?? "Unauthorized" };

  const supabase = await createAuthClient();
  const employeeId = await getTeacherEmployeeId(supabase, ctx.effectiveUserId);
  const meetingId = formData.get("meeting_id") as string;
  const studentId = formData.get("student_id") as string;
  const { data: student } = await supabase.from("students").select("school_id").eq("id", studentId).single();
  if (!student) return { error: "Student not found" };

  await completeInstructionalMeeting(supabase, {
    meetingId,
    studentId,
    schoolId: student.school_id,
    notes: (formData.get("notes") as string) || undefined,
    decisions: (formData.get("decisions") as string) || undefined,
    followUpDate: (formData.get("follow_up_date") as string) || undefined,
    taskTitle: (formData.get("task_title") as string) || undefined,
    taskDueDate: (formData.get("task_due_date") as string) || undefined,
    assignedEmployeeId: employeeId,
    actorUserId: ctx.effectiveUserId,
    actorEmployeeId: employeeId ?? undefined,
  });

  revalidatePath(`/dashboard/teacher/students/${studentId}`);
  return { success: true };
}
