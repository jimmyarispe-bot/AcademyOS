import type { createAuthClient } from "@/lib/supabase/server-auth";
import { writeTimelineEvent } from "@/lib/platform/automation/timeline";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export type LifecycleStage =
  | "inquiry"
  | "applicant"
  | "accepted"
  | "enrolled"
  | "active"
  | "graduating"
  | "withdrawn"
  | "alumni";

export interface TransitionStudentInput {
  studentId: string;
  toStage: LifecycleStage;
  triggerSource?: "manual" | "admissions" | "automation" | "workflow" | "system";
  triggeredBy?: string | null;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export async function transitionStudentLifecycle(
  supabase: AuthClient,
  input: TransitionStudentInput
): Promise<{ success: boolean; error?: string; fromStage?: string }> {
  const { data: student } = await supabase
    .from("students")
    .select("id, school_id, lifecycle_stage, first_name, last_name, admissions_lead_id, admissions_application_id")
    .eq("id", input.studentId)
    .single();

  if (!student) return { success: false, error: "Student not found" };

  const fromStage = student.lifecycle_stage as LifecycleStage;
  if (fromStage === input.toStage) {
    return { success: true, fromStage };
  }

  const { error: updateError } = await supabase
    .from("students")
    .update({ lifecycle_stage: input.toStage })
    .eq("id", input.studentId);

  if (updateError) return { success: false, error: updateError.message };

  await supabase.from("ssis_lifecycle_transitions").insert({
    student_id: input.studentId,
    from_stage: fromStage,
    to_stage: input.toStage,
    trigger_source: input.triggerSource ?? "manual",
    triggered_by: input.triggeredBy ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  });

  await writeTimelineEvent(supabase, {
    schoolId: student.school_id,
    module: "sis",
    entityType: "student",
    entityId: input.studentId,
    eventType: "status_change",
    title: `Lifecycle: ${fromStage} → ${input.toStage}`,
    body: input.notes ?? `Student moved to ${input.toStage}`,
    actorUserId: input.triggeredBy,
    metadata: { fromStage, toStage: input.toStage, ...input.metadata },
  });

  await supabase.from("ssis_communication_events").insert({
    student_id: input.studentId,
    school_id: student.school_id,
    channel: "workflow",
    direction: "internal",
    subject: `Lifecycle transition: ${input.toStage}`,
    body: `${student.first_name} ${student.last_name} transitioned from ${fromStage} to ${input.toStage}`,
    actor_user_id: input.triggeredBy ?? null,
    metadata: input.metadata ?? {},
  });

  const { dispatchSsissLifecycleAutomation } = await import("@/lib/ssis/automation");
  await dispatchSsissLifecycleAutomation(supabase, {
    studentId: input.studentId,
    schoolId: student.school_id,
    fromStage,
    toStage: input.toStage,
    admissionsLeadId: student.admissions_lead_id,
    admissionsApplicationId: student.admissions_application_id,
    triggeredBy: input.triggeredBy,
    notes: input.notes,
  });

  return { success: true, fromStage };
}

export async function getStudentLifecycleHistory(supabase: AuthClient, studentId: string) {
  const { data } = await supabase
    .from("ssis_lifecycle_transitions")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
