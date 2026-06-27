"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { SCHOLARSHIP_APPROVER } from "@/lib/constants/admissions";

export async function updateScholarshipStatus(
  id: string,
  status: string,
  approvedAmount?: number,
  reviewNotes?: string
) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  const updates: Record<string, unknown> = {
    scholarship_status: status,
    reviewed_by_user_id: user?.id ?? null,
    approver_name: SCHOLARSHIP_APPROVER,
    review_notes: reviewNotes ?? null,
  };

  if (status === "approved") {
    updates.approved_amount = approvedAmount ?? null;
    updates.approved_at = new Date().toISOString();
    updates.remaining_award_balance = approvedAmount ?? null;
  }

  if (status === "submitted") {
    updates.submitted_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("scholarship_applications")
    .update(updates)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/scholarships");
  return { success: true };
}

export async function createScholarshipDocument(formData: FormData) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("scholarship_documents").insert({
    scholarship_application_id: formData.get("scholarship_application_id") as string,
    document_type: formData.get("document_type") as string,
    file_name: formData.get("file_name") as string,
    storage_path: formData.get("storage_path") as string,
    uploaded_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/scholarships");
  return { success: true };
}

export async function submitScholarshipApplication(formData: FormData) {
  const supabase = await createAuthClient();

  const { error } = await supabase.from("scholarship_applications").insert({
    application_id: formData.get("application_id") as string,
    requested_amount: Number(formData.get("requested_amount")) || null,
    household_income: Number(formData.get("household_income")) || null,
    scholarship_status: "submitted",
    submitted_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/scholarships");
  return { success: true };
}
