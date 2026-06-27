"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { transitionStudentLifecycle, type LifecycleStage } from "@/lib/ssis/transitions";
import { logStudentCommunicationEvent } from "@/lib/ssis/timeline";
import { computeStudentSuccessScore } from "@/lib/ssis/score";

export async function recordStudentAttendance(formData: FormData) {
  const supabase = await createAuthClient();
  const studentId = formData.get("student_id") as string;
  const status = formData.get("status") as string;
  const context = (formData.get("attendance_context") as string) || "daily";
  const date = (formData.get("attendance_date") as string) || new Date().toISOString().split("T")[0];
  const notes = (formData.get("notes") as string) || null;
  const notifyParent = formData.get("notify_parent") === "true";

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("student_attendance_records").upsert(
    {
      student_id: studentId,
      attendance_date: date,
      status,
      attendance_context: context,
      notes,
      parent_notified: notifyParent,
      parent_notified_at: notifyParent ? new Date().toISOString() : null,
      recorded_by: user?.id ?? null,
    },
    { onConflict: "student_id,attendance_date" }
  );

  if (error) return { error: error.message };

  await logStudentCommunicationEvent(supabase, {
    studentId,
    channel: "attendance",
    direction: "internal",
    subject: `Attendance: ${status.replace(/_/g, " ")}`,
    body: notes ?? `Recorded for ${date}`,
    actorUserId: user?.id ?? null,
  });

  await computeStudentSuccessScore(supabase, studentId);
  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: true };
}

export async function recordBehaviorEvent(formData: FormData) {
  const supabase = await createAuthClient();
  const studentId = formData.get("student_id") as string;
  const eventType = formData.get("event_type") as string;
  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || null;

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("student_behavior_events").insert({
    student_id: studentId,
    event_type: eventType,
    title,
    description,
    recorded_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  await logStudentCommunicationEvent(supabase, {
    studentId,
    channel: "behavior",
    direction: "internal",
    subject: title,
    body: description ?? eventType,
    actorUserId: user?.id ?? null,
  });

  await computeStudentSuccessScore(supabase, studentId);
  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: true };
}

export async function transitionStudentStage(formData: FormData) {
  const supabase = await createAuthClient();
  const studentId = formData.get("student_id") as string;
  const toStage = formData.get("to_stage") as LifecycleStage;
  const notes = (formData.get("notes") as string) || undefined;

  const { data: { user } } = await supabase.auth.getUser();

  const result = await transitionStudentLifecycle(supabase, {
    studentId,
    toStage,
    triggerSource: "manual",
    triggeredBy: user?.id ?? null,
    notes,
  });

  if (!result.success) return { error: result.error };
  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: true };
}

export async function refreshStudentSuccessScore(studentId: string) {
  const supabase = await createAuthClient();
  await computeStudentSuccessScore(supabase, studentId);
  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: true };
}
