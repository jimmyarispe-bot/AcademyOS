"use server";

import { setAutomationStartedAt } from "@/lib/admissions/automation-gate";
import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/platform/activity";
import { assertAnyPermission } from "@/lib/platform/identity/action-guards";
import { resolveSchoolContext } from "@/lib/platform/shared/context";
import type { GradeValue } from "@/lib/constants/grades";
import { parseProgramValue } from "@/lib/constants/programs";
import type { LeadStageValue } from "@/lib/constants/admissions";
import { parseFundingSourcesFromForm } from "@/lib/funding/helpers";
import { syncLeadFundingSources } from "@/lib/funding/sync";
import { recordInitialStage } from "@/lib/admissions/workflow";
import { transitionCaseStage } from "@/lib/admissions/case/orchestration";
import {
  onEnrollmentCompleted,
  onInquirySubmitted,
  onInterviewScheduled,
  onTourScheduled,
} from "@/lib/admissions/communications/triggers";

async function requireAdmissionsManage() {
  return assertAnyPermission("admissions.manage", "admissions.accept");
}

export async function createLead(formData: FormData) {
  const auth = await requireAdmissionsManage();
  if ("error" in auth) return { error: auth.error };
  const supabase = auth.supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const fundingSources = parseFundingSourcesFromForm(formData);
  const schoolId = formData.get("school_id") as string;
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const program = parseProgramValue(formData.get("program") as string);
  const applyingForGrade = (formData.get("applying_for_grade") as GradeValue) || null;
  const referralSource = (formData.get("referral_source") as string) || null;

  const { data, error } = await supabase
    .from("admissions_leads")
    .insert({
      school_id: schoolId,
      first_name: firstName,
      last_name: lastName,
      preferred_name: (formData.get("preferred_name") as string) || null,
      date_of_birth: (formData.get("date_of_birth") as string) || null,
      current_grade: (formData.get("current_grade") as GradeValue) || null,
      applying_for_grade: applyingForGrade,
      program,
      referral_source: referralSource,
      guardian_first_name: (formData.get("guardian_first_name") as string) || null,
      guardian_last_name: (formData.get("guardian_last_name") as string) || null,
      guardian_email: (formData.get("guardian_email") as string) || null,
      guardian_phone: (formData.get("guardian_phone") as string) || null,
      lead_stage: "new_inquiry",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  try {
    await syncLeadFundingSources(supabase, data.id, fundingSources);
  } catch (syncError) {
    await supabase.from("admissions_leads").delete().eq("id", data.id);
    return {
      error: syncError instanceof Error ? syncError.message : "Failed to save funding sources",
    };
  }

  await recordInitialStage(supabase, data.id, user?.id ?? null);
  await onInquirySubmitted(supabase, data.id, user?.id ?? null);

  const schoolCtx = await resolveSchoolContext(supabase, schoolId);
  await recordActivity(supabase, {
    eventType: "admissions.inquiry_created",
    moduleKey: "admissions",
    entityType: "admissions_lead",
    entityId: data.id,
    title: "Inquiry created",
    summary: `${firstName} ${lastName}`,
    organizationId: schoolCtx?.organizationId,
    schoolId,
    actorUserId: user?.id ?? null,
    payload: {
      program,
      applying_for_grade: applyingForGrade,
      referral_source: referralSource,
      lead_stage: "new_inquiry",
    },
    sourceTable: "admissions_leads",
    sourceId: data.id,
  });

  revalidatePath("/dashboard/admissions");
  return { id: data.id };
}

export async function updateLeadStage(leadId: string, leadStage: LeadStageValue) {
  const auth = await assertAnyPermission("admissions.manage", "admissions.accept");
  if ("error" in auth) return { error: auth.error };
  const supabase = auth.supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await transitionCaseStage(supabase, leadId, leadStage, user?.id ?? null);

  if (result.error) return { error: result.error };

  if (leadStage === "enrolled") {
    const { data: application } = await supabase
      .from("admissions_applications")
      .select("id")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("admissions_lead_id", leadId)
      .maybeSingle();

    if (!student && application?.id) {
      const { completeEnrollmentHandoff } = await import(
        "@/lib/admissions/handoff/complete-enrollment-handoff"
      );
      const handoff = await completeEnrollmentHandoff(supabase, {
        leadId,
        applicationId: application.id,
        actorUserId: user?.id ?? null,
      });
      if (!handoff.success) {
        return { error: handoff.error ?? handoff.activationError ?? "Enrollment handoff failed" };
      }
    } else if (!student) {
      await onEnrollmentCompleted(
        supabase,
        leadId,
        application?.id ?? null,
        user?.id ?? null
      );
    }
  }

  revalidatePath("/dashboard/admissions");
  revalidatePath(`/dashboard/admissions/cases/${leadId}`);
  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  return { success: true };
}

export async function addLeadNote(leadId: string, noteText: string) {
  const auth = await requireAdmissionsManage();
  if ("error" in auth) return { error: auth.error };
  const supabase = auth.supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("admissions_notes").insert({
    lead_id: leadId,
    note_text: noteText,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  return { success: true };
}

/**
 * Switch automated parent follow-up on, or off, for one family.
 *
 * THE DECISION THIS REPRESENTS. Leads already in JAG when the public inquiry
 * URLs went live on 10 September 2026 carry `automation_started_at = null` —
 * automation does not touch them. That is what let the forms go on the websites
 * without also chasing 289 families, 113 of whom had been parked at
 * `information_sent` since 2 February. Someone decides, per family, when it is
 * right to start.
 *
 * IT RESUMES, IT DOES NOT RESTART. The reminder engine derives which wait
 * applies from the lead's CURRENT stage, so a family sitting at
 * `shadow_day_scheduled` is chased about their shadow day, not welcomed as a
 * new inquiry. Most families a human starts are already halfway through the
 * process; that is the normal case, not the exception.
 *
 * Stopping clears the timestamp. Any timer already open stays open — closing it
 * is a separate, deliberate act, because silently discarding a live reminder is
 * how a family falls out of the process without anyone noticing.
 */
export async function setLeadAutomation(leadId: string, enabled: boolean) {
  const auth = await requireAdmissionsManage();
  if ("error" in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { error } = await setAutomationStartedAt(
    supabase,
    leadId,
    enabled ? new Date().toISOString() : null
  );

  if (error) return { error };

  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  revalidatePath(`/dashboard/admissions/cases/${leadId}`);
  return { success: true };
}

export async function addLeadTask(leadId: string, taskName: string, dueDate: string | null) {
  const auth = await requireAdmissionsManage();
  if ("error" in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { error } = await supabase.from("admissions_tasks").insert({
    lead_id: leadId,
    task_name: taskName,
    due_date: dueDate || null,
    task_status: "open",
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  return { success: true };
}

export async function completeTask(taskId: string, leadId: string) {
  const auth = await requireAdmissionsManage();
  if ("error" in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { error } = await supabase
    .from("admissions_tasks")
    .update({ task_status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  return { success: true };
}

export async function scheduleTour(formData: FormData) {
  const auth = await requireAdmissionsManage();
  if ("error" in auth) return { error: auth.error };
  const supabase = auth.supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const leadId = formData.get("lead_id") as string;
  const scheduledAt = formData.get("scheduled_at") as string;

  const { error } = await supabase.from("admissions_tours").insert({
    lead_id: leadId,
    scheduled_at: scheduledAt,
    tour_type: (formData.get("tour_type") as string) || "in_person",
    campus_id: (formData.get("campus_id") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });

  if (error) return { error: error.message };

  const result = await transitionCaseStage(
    supabase,
    leadId,
    "tour_scheduled",
    user?.id ?? null,
    { tourScheduledAt: scheduledAt }
  );

  if (result.error) return { error: result.error };

  await onTourScheduled(supabase, leadId, scheduledAt, user?.id ?? null);

  revalidatePath("/dashboard/admissions");
  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  return { success: true };
}

export async function scheduleInterview(formData: FormData) {
  const auth = await requireAdmissionsManage();
  if ("error" in auth) return { error: auth.error };
  const supabase = auth.supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const leadId = formData.get("lead_id") as string;
  const applicationId = (formData.get("application_id") as string) || null;
  const scheduledAt = formData.get("scheduled_at") as string;
  const interviewType = (formData.get("interview_type") as string) || "virtual";

  await supabase.from("admissions_interviews").insert({
    lead_id: leadId,
    application_id: applicationId,
    scheduled_at: scheduledAt,
    interview_type: interviewType,
    notes: (formData.get("notes") as string) || null,
    host_user_id: user?.id ?? null,
  });

  const pipelineStage =
    interviewType === "initial_assessment" ? "shadow_day_scheduled" : "interest_call_scheduled";
  const { transitionCasePipelineStage } = await import("@/lib/admissions/case/orchestration");
  const stageResult = await transitionCasePipelineStage(
    supabase,
    leadId,
    pipelineStage,
    user?.id ?? null
  );
  if (stageResult.error) return { error: stageResult.error };

  await onInterviewScheduled(
    supabase,
    leadId,
    applicationId,
    scheduledAt,
    user?.id ?? null
  );

  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  return { success: true };
}
