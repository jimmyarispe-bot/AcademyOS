"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { signEnrollmentDocument as signPacketDocument } from "@/lib/admissions/enrollment-packets";

export async function updateChecklistTemplateItem(formData: FormData) {
  const supabase = await createAuthClient();
  const id = formData.get("id") as string;
  const schoolId = formData.get("school_id") as string;

  const { error } = await supabase
    .from("admissions_checklist_template_items")
    .update({
      label: formData.get("label") as string,
      is_required: formData.get("is_required") === "true",
      is_active: formData.get("is_active") !== "false",
      sort_order: Number(formData.get("sort_order")) || 0,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/checklist");
  return { success: true };
}

export async function updateChecklistItemStatus(formData: FormData) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("admissions_application_checklist_items")
    .update({
      status: formData.get("status") as string,
      notes: (formData.get("notes") as string) || null,
      completed_at: formData.get("status") === "completed" ? new Date().toISOString() : null,
      completed_by: user?.id ?? null,
    })
    .eq("id", formData.get("id") as string);

  if (error) return { error: error.message };

  const applicationId = formData.get("application_id") as string;
  revalidatePath(`/dashboard/admissions/leads/${formData.get("lead_id")}`);
  revalidatePath(`/apply/portal/${applicationId}`);
  return { success: true };
}

export async function saveStateFundingAward(formData: FormData) {
  const supabase = await createAuthClient();
  const id = formData.get("id") as string;

  const { error } = await supabase
    .from("state_funding_verifications")
    .update({
      funding_program_id: (formData.get("funding_program_id") as string) || null,
      state_code: (formData.get("state_code") as string) || null,
      award_amount: Number(formData.get("award_amount")) || null,
      award_id: (formData.get("award_id") as string) || null,
      state_student_id: (formData.get("state_student_id") as string) || null,
      award_year: (formData.get("award_year") as string) || null,
      renewal_date: (formData.get("renewal_date") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/state-funding");
  return { success: true };
}

export async function recordExpectedFundingPayment(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("state_funding_expected_payments").insert({
    state_funding_verification_id: formData.get("verification_id") as string,
    school_id: formData.get("school_id") as string,
    expected_amount: Number(formData.get("expected_amount")),
    expected_date: formData.get("expected_date") as string,
    award_year: (formData.get("award_year") as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/reconciliation");
  return { success: true };
}

export async function recordReceivedFundingPayment(formData: FormData) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("state_funding_received_payments").insert({
    state_funding_verification_id: formData.get("verification_id") as string,
    school_id: formData.get("school_id") as string,
    amount: Number(formData.get("amount")),
    payment_date: formData.get("payment_date") as string,
    reference_number: (formData.get("reference_number") as string) || null,
    recorded_by_user_id: user?.id ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/reconciliation");
  return { success: true };
}

export async function saveFundingProgram(formData: FormData) {
  const supabase = await createAuthClient();
  const id = formData.get("id") as string | null;

  const payload = {
    school_id: (formData.get("school_id") as string) || null,
    program_code: formData.get("program_code") as string,
    program_name: formData.get("program_name") as string,
    state_code: formData.get("state_code") as string,
    funding_agency: formData.get("funding_agency") as string,
    maximum_award: Number(formData.get("maximum_award")) || null,
    payment_schedule: (formData.get("payment_schedule") as string) || "monthly",
    renewal_rules: (formData.get("renewal_rules") as string) || null,
    website: (formData.get("website") as string) || null,
    is_active: formData.get("is_active") !== "false",
  };

  const { error } = id
    ? await supabase.from("funding_program_catalog").update(payload).eq("id", id)
    : await supabase.from("funding_program_catalog").insert(payload);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admissions/funding-programs");
  return { success: true };
}

export async function signEnrollmentPacket(formData: FormData) {
  return signPacketDocument(formData);
}
