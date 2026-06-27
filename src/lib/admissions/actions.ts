"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import type { GradeValue } from "@/lib/constants/grades";
import type { ProgramValue } from "@/lib/constants/programs";
import type { LeadStageValue } from "@/lib/constants/admissions";
import { parseFundingSourcesFromForm } from "@/lib/funding/helpers";
import { syncLeadFundingSources } from "@/lib/funding/sync";
import { recordInitialStage, transitionLeadStage } from "@/lib/admissions/workflow";
import {
  onEnrollmentCompleted,
  onInquirySubmitted,
  onInterviewScheduled,
  onTourScheduled,
} from "@/lib/admissions/communications/triggers";

export async function createLead(formData: FormData) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const fundingSources = parseFundingSourcesFromForm(formData);

  const { data, error } = await supabase
    .from("admissions_leads")
    .insert({
      school_id: formData.get("school_id") as string,
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      preferred_name: (formData.get("preferred_name") as string) || null,
      date_of_birth: (formData.get("date_of_birth") as string) || null,
      current_grade: (formData.get("current_grade") as GradeValue) || null,
      applying_for_grade: (formData.get("applying_for_grade") as GradeValue) || null,
      program: (formData.get("program") as ProgramValue) || null,
      referral_source: (formData.get("referral_source") as string) || null,
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

  revalidatePath("/dashboard/admissions");
  return { id: data.id };
}

export async function updateLeadStage(leadId: string, leadStage: LeadStageValue) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await transitionLeadStage(supabase, leadId, leadStage, user?.id ?? null);

  if (result.error) return { error: result.error };

  if (leadStage === "enrolled") {
    const { data: application } = await supabase
      .from("admissions_applications")
      .select("id")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await onEnrollmentCompleted(
      supabase,
      leadId,
      application?.id ?? null,
      user?.id ?? null
    );
  }

  revalidatePath("/dashboard/admissions");
  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  return { success: true };
}

export async function addLeadNote(leadId: string, noteText: string) {
  const supabase = await createAuthClient();
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

export async function addLeadTask(leadId: string, taskName: string, dueDate: string | null) {
  const supabase = await createAuthClient();

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
  const supabase = await createAuthClient();

  const { error } = await supabase
    .from("admissions_tasks")
    .update({ task_status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  return { success: true };
}

export async function scheduleTour(formData: FormData) {
  const supabase = await createAuthClient();
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

  const result = await transitionLeadStage(
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
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const leadId = formData.get("lead_id") as string;
  const applicationId = (formData.get("application_id") as string) || null;
  const scheduledAt = formData.get("scheduled_at") as string;

  await supabase.from("admissions_interviews").insert({
    lead_id: leadId,
    application_id: applicationId,
    scheduled_at: scheduledAt,
    interview_type: (formData.get("interview_type") as string) || "virtual",
    notes: (formData.get("notes") as string) || null,
    host_user_id: user?.id ?? null,
  });

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
