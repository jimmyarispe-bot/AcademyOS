"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import type { GradeValue } from "@/lib/constants/grades";
import type { ProgramValue } from "@/lib/constants/programs";
import { parseFundingSourcesFromForm } from "@/lib/funding/helpers";
import { transitionLeadStage } from "@/lib/admissions/workflow";
import {
  getApplicationDocuments,
  getPortalApplication,
  getScholarshipDocuments,
  getScholarshipForApplication,
  getStateFundingVerifications,
} from "@/lib/admissions/portal/queries";
import { runAutomatedAcceptanceWorkflow } from "@/lib/admissions/portal/acceptance";
import {
  onApplicationStarted,
  onApplicationSubmitted,
  onDocumentUploaded,
  onFinancialAidSubmitted,
  onFundingVerificationDecision,
  onInquirySubmitted,
} from "@/lib/admissions/communications/triggers";

export async function submitPublicInquiry(formData: FormData) {
  const supabase = await createAuthClient();
  const fundingSources = parseFundingSourcesFromForm(formData);

  const { data, error } = await supabase.rpc("submit_public_admissions_inquiry", {
    p_school_id: formData.get("school_id") as string,
    p_first_name: formData.get("first_name") as string,
    p_last_name: formData.get("last_name") as string,
    p_preferred_name: (formData.get("preferred_name") as string) || null,
    p_date_of_birth: (formData.get("date_of_birth") as string) || null,
    p_current_grade: (formData.get("current_grade") as GradeValue) || null,
    p_applying_for_grade: (formData.get("applying_for_grade") as GradeValue) || null,
    p_program: (formData.get("program") as ProgramValue) || null,
    p_referral_source: (formData.get("referral_source") as string) || null,
    p_guardian_first_name: (formData.get("guardian_first_name") as string) || null,
    p_guardian_last_name: (formData.get("guardian_last_name") as string) || null,
    p_guardian_email: formData.get("guardian_email") as string,
    p_guardian_phone: (formData.get("guardian_phone") as string) || null,
    p_funding_source_codes: fundingSources,
  });

  if (error) return { error: error.message };

  await onInquirySubmitted(supabase, data as string);

  revalidatePath("/apply");
  return { leadId: data as string };
}

export async function startApplication(leadId: string, schoolYearId: string) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("admissions_applications")
    .insert({
      lead_id: leadId,
      school_year_id: schoolYearId,
      application_status: "in_progress",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.rpc("ensure_state_funding_verifications", {
    p_application_id: data.id,
  });

  await transitionLeadStage(supabase, leadId, "application_started", user?.id ?? null);

  await onApplicationStarted(supabase, leadId, data.id, user?.id ?? null);

  revalidatePath("/apply/portal");
  revalidatePath(`/apply/portal/${data.id}`);
  return { applicationId: data.id };
}

export async function saveApplicationDetails(formData: FormData) {
  const supabase = await createAuthClient();
  const applicationId = formData.get("application_id") as string;

  const { error } = await supabase
    .from("admissions_applications")
    .update({
      previous_school: (formData.get("previous_school") as string) || null,
      emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
      emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
      learning_needs_summary: (formData.get("learning_needs_summary") as string) || null,
      application_status: "in_progress",
    })
    .eq("id", applicationId);

  if (error) return { error: error.message };

  revalidatePath(`/apply/portal/${applicationId}`);
  return { success: true };
}

export async function registerApplicationDocument(formData: FormData) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const applicationId = formData.get("application_id") as string;
  const documentSubtype = (formData.get("document_subtype") as string) || null;

  const { error } = await supabase.from("application_documents").insert({
    application_id: applicationId,
    document_type: formData.get("document_type") as string,
    document_subtype: documentSubtype,
    file_name: formData.get("file_name") as string,
    storage_path: formData.get("storage_path") as string,
    mime_type: (formData.get("mime_type") as string) || null,
    file_size_bytes: Number(formData.get("file_size_bytes")) || null,
    uploaded_by: user?.id ?? null,
    document_status: "uploaded",
  });

  if (error) return { error: error.message };

  if (documentSubtype === "state_funding") {
    await supabase
      .from("state_funding_verifications")
      .update({ verification_status: "documents_submitted" })
      .eq("application_id", applicationId)
      .in("verification_status", ["pending", "rejected"]);
  }

  const { data: application } = await supabase
    .from("admissions_applications")
    .select("lead_id")
    .eq("id", applicationId)
    .single();

  if (application?.lead_id) {
    await onDocumentUploaded(supabase, application.lead_id, applicationId, user?.id ?? null);
  }

  revalidatePath(`/apply/portal/${applicationId}`);
  return { success: true };
}

export async function deleteApplicationDocument(documentId: string, applicationId: string) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from("application_documents").delete().eq("id", documentId);

  if (error) return { error: error.message };

  revalidatePath(`/apply/portal/${applicationId}`);
  return { success: true };
}

export async function updateStateFundingVerification(formData: FormData) {
  const supabase = await createAuthClient();
  const verificationId = formData.get("verification_id") as string;
  const applicationId = formData.get("application_id") as string;

  const { error } = await supabase
    .from("state_funding_verifications")
    .update({
      state_program_id: (formData.get("state_program_id") as string) || null,
      notes: (formData.get("notes") as string) || null,
      verification_status: "documents_submitted",
    })
    .eq("id", verificationId);

  if (error) return { error: error.message };

  revalidatePath(`/apply/portal/${applicationId}`);
  revalidatePath(`/dashboard/admissions/leads/${formData.get("lead_id")}`);
  return { success: true };
}

export async function verifyStateFundingStaff(formData: FormData) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const verificationId = formData.get("verification_id") as string;
  const applicationId = formData.get("application_id") as string;
  const leadId = formData.get("lead_id") as string;
  const status = formData.get("verification_status") as string;

  const updates: Record<string, unknown> = {
    verification_status: status,
    rejection_reason: (formData.get("rejection_reason") as string) || null,
  };

  if (status === "verified") {
    updates.verified_by_user_id = user?.id ?? null;
    updates.verified_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("state_funding_verifications")
    .update(updates)
    .eq("id", verificationId);

  if (error) return { error: error.message };

  if (status === "verified") {
    await maybeRunAutomatedAcceptance(supabase, applicationId, user?.id ?? null);
  }

  await onFundingVerificationDecision(
    supabase,
    leadId,
    applicationId,
    status,
    (formData.get("rejection_reason") as string) || null,
    user?.id ?? null
  );

  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  revalidatePath(`/apply/portal/${applicationId}`);
  return { success: true };
}

export async function saveFinancialAidApplication(formData: FormData) {
  const supabase = await createAuthClient();
  const applicationId = formData.get("application_id") as string;
  const scholarshipId = formData.get("scholarship_application_id") as string | null;

  const payload = {
    application_id: applicationId,
    requested_amount: Number(formData.get("requested_amount")) || null,
    household_income: Number(formData.get("household_income")) || null,
    scholarship_status: "draft" as const,
  };

  if (scholarshipId) {
    const { error } = await supabase
      .from("scholarship_applications")
      .update(payload)
      .eq("id", scholarshipId);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("scholarship_applications").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath(`/apply/portal/${applicationId}`);
  return { success: true };
}

export async function registerScholarshipDocument(formData: FormData) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const applicationId = formData.get("application_id") as string;

  const { error } = await supabase.from("scholarship_documents").insert({
    scholarship_application_id: formData.get("scholarship_application_id") as string,
    document_type: formData.get("document_type") as string,
    file_name: formData.get("file_name") as string,
    storage_path: formData.get("storage_path") as string,
    uploaded_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  const { data: application } = await supabase
    .from("admissions_applications")
    .select("lead_id")
    .eq("id", applicationId)
    .single();

  if (application?.lead_id) {
    await onFinancialAidSubmitted(
      supabase,
      application.lead_id,
      applicationId,
      user?.id ?? null
    );
  }

  revalidatePath(`/apply/portal/${applicationId}`);
  return { success: true };
}

export async function submitApplication(applicationId: string) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const portalData = await getPortalApplication(applicationId);
  if (!portalData) return { error: "Application not found" };

  const [documents, verifications, scholarship] = await Promise.all([
    getApplicationDocuments(applicationId),
    getStateFundingVerifications(applicationId),
    getScholarshipForApplication(applicationId),
  ]);

  const scholarshipDocuments = scholarship
    ? await getScholarshipDocuments(scholarship.id)
    : [];

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("admissions_applications")
    .update({
      application_status: "submitted",
      submitted_at: now,
    })
    .eq("id", applicationId);

  if (error) return { error: error.message };

  await transitionLeadStage(
    supabase,
    portalData.application.lead_id,
    "application_submitted",
    user?.id ?? null
  );

  await onApplicationSubmitted(
    supabase,
    portalData.application.lead_id,
    applicationId,
    user?.id ?? null
  );

  const acceptance = await runAutomatedAcceptanceWorkflow(
    supabase,
    applicationId,
    user?.id ?? null,
    {
      application: portalData.application,
      documents,
      verifications,
      scholarship,
      scholarshipDocuments,
      fundingCodes: portalData.fundingCodes,
    }
  );

  revalidatePath(`/apply/portal/${applicationId}`);
  revalidatePath("/apply/portal");
  revalidatePath(`/dashboard/admissions/leads/${portalData.application.lead_id}`);

  return {
    success: true,
    autoAccepted: acceptance.accepted === true,
  };
}

async function maybeRunAutomatedAcceptance(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  applicationId: string,
  userId: string | null
) {
  const portalData = await getPortalApplication(applicationId);
  if (!portalData) return;

  const [documents, verifications, scholarship] = await Promise.all([
    getApplicationDocuments(applicationId),
    getStateFundingVerifications(applicationId),
    getScholarshipForApplication(applicationId),
  ]);

  const scholarshipDocuments = scholarship
    ? await getScholarshipDocuments(scholarship.id)
    : [];

  if (portalData.application.application_status !== "submitted") return;

  await runAutomatedAcceptanceWorkflow(supabase, applicationId, userId, {
    application: portalData.application,
    documents,
    verifications,
    scholarship,
    scholarshipDocuments,
    fundingCodes: portalData.fundingCodes,
  });
}

export async function runStaffAcceptanceCheck(applicationId: string, leadId: string) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const portalData = await getPortalApplication(applicationId);
  if (!portalData) return { error: "Application not found" };

  const [documents, verifications, scholarship] = await Promise.all([
    getApplicationDocuments(applicationId),
    getStateFundingVerifications(applicationId),
    getScholarshipForApplication(applicationId),
  ]);

  const scholarshipDocuments = scholarship
    ? await getScholarshipDocuments(scholarship.id)
    : [];

  const result = await runAutomatedAcceptanceWorkflow(
    supabase,
    applicationId,
    user?.id ?? null,
    {
      application: portalData.application,
      documents,
      verifications,
      scholarship,
      scholarshipDocuments,
      fundingCodes: portalData.fundingCodes,
    }
  );

  revalidatePath(`/dashboard/admissions/leads/${leadId}`);
  revalidatePath(`/apply/portal/${applicationId}`);

  if (result.error) return { error: result.error };
  if (!result.accepted) return { success: true, accepted: false, reason: result.reason };
  return { success: true, accepted: true };
}
