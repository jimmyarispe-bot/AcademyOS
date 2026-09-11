"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { assertAnyPermission } from "@/lib/platform/identity/action-guards";
import {
  checkRateLimitAsync,
  getClientIpFromHeaders,
} from "@/lib/platform/api-rate-limit";
import type { GradeValue } from "@/lib/constants/grades";
import { parseProgramValue } from "@/lib/constants/programs";
import { parseFundingSourcesFromForm } from "@/lib/funding/helpers";
import { recordInitialStage } from "@/lib/admissions/workflow";
import { carryForwardInquiryAnswers } from "@/lib/admissions/interest-form/carry-forward";
import { transitionCaseStage } from "@/lib/admissions/case/orchestration";
import {
  getApplicationDocuments,
  getPortalApplication,
  getScholarshipDocuments,
  getScholarshipForApplication,
  getStateFundingVerifications,
} from "@/lib/admissions/portal/queries";
import { runAutomatedAcceptanceWorkflow } from "@/lib/admissions/portal/acceptance";
import { getLegacyUserFromAuthClient } from "@/lib/platform/authentication";
import {
  onApplicationStarted,
  onApplicationSubmitted,
  onDocumentUploaded,
  onFinancialAidSubmitted,
  onFundingVerificationDecision,
  onInquirySubmitted,
} from "@/lib/admissions/communications/triggers";

export async function submitPublicInquiry(formData: FormData) {
  // B.1 — honeypot (bots fill hidden fields)
  const honeypot = String(formData.get("company_website") ?? "").trim();
  if (honeypot) {
    return { error: "Unable to submit inquiry." };
  }

  const headerStore = await headers();
  const ip = getClientIpFromHeaders(headerStore);
  const limited = await checkRateLimitAsync(`admissions-inquiry:${ip}`, 5, 60_000);
  if (!limited.ok) {
    return { error: "Too many inquiries. Please try again later." };
  }

  // Optional Cloudflare Turnstile when TURNSTILE_SECRET_KEY is configured
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const token = String(formData.get("cf-turnstile-response") ?? "");
    if (!token) return { error: "Please complete the captcha." };
    try {
      const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: turnstileSecret, response: token, remoteip: ip }),
      });
      const outcome = (await verify.json()) as { success?: boolean };
      if (!outcome.success) return { error: "Captcha verification failed." };
    } catch {
      return { error: "Captcha verification unavailable." };
    }
  }

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
    p_program: parseProgramValue(formData.get("program") as string),
    p_referral_source: (formData.get("referral_source") as string) || null,
    p_guardian_first_name: (formData.get("guardian_first_name") as string) || null,
    p_guardian_last_name: (formData.get("guardian_last_name") as string) || null,
    p_guardian_email: formData.get("guardian_email") as string,
    p_guardian_phone: (formData.get("guardian_phone") as string) || null,
    p_funding_source_codes: fundingSources,
  });

  if (error) return { error: error.message };

  const leadId = data as string;

  /**
   * Post-RPC work runs as the service role, not as the anonymous visitor.
   *
   * The RPC above is SECURITY DEFINER, so the lead is created regardless. These
   * two calls are not: RLS on admissions_leads hides the new row from an
   * anonymous client, so `loadMergeContext` read back nothing and threw
   * "Lead not found". The parent saw that error on /admissions/schedule-tour,
   * /discovery-call and /assessment and reasonably concluded their request had
   * failed — while the lead sat in the pipeline with no email sent to anyone.
   *
   * The interest form at /apply already did it this way, with the same comment.
   * These three pages never got the fix.
   */
  const admin = createServiceRoleClient();
  await recordInitialStage(admin, leadId, null);

  /**
   * A failed notification must not be reported as a failed submission. The
   * family's request exists at this point; telling them otherwise invites a
   * duplicate and loses their trust in the form. Log it and hand back the lead.
   */
  try {
    await onInquirySubmitted(admin, leadId);
  } catch (notifyError) {
    console.error("[submitPublicInquiry] lead created but notification failed", {
      leadId,
      error: notifyError instanceof Error ? notifyError.message : String(notifyError),
    });
  }

  revalidatePath("/apply");
  return { leadId };
}

export async function startApplication(leadId: string, schoolYearId: string) {
  const supabase = await createAuthClient();
  const user = await getLegacyUserFromAuthClient(supabase);

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

  /**
   * Carry forward what the family already told us on their inquiry.
   *
   * The application invitation email promises they will not have to repeat
   * themselves. A failure here must not block the application from opening —
   * a family who cannot start is worse off than one who retypes one answer —
   * so it is logged and the application proceeds.
   */
  try {
    const carried = await carryForwardInquiryAnswers(leadId, data.id);
    if ("error" in carried) {
      console.error("[startApplication] inquiry answers not carried forward", {
        leadId,
        applicationId: data.id,
        error: carried.error,
      });
    }
  } catch (carryError) {
    console.error("[startApplication] inquiry carry-forward threw", {
      leadId,
      applicationId: data.id,
      error: carryError instanceof Error ? carryError.message : String(carryError),
    });
  }

  await transitionCaseStage(supabase, leadId, "application_started", user?.id ?? null);

  await onApplicationStarted(supabase, leadId, data.id, user?.id ?? null);

  revalidatePath("/apply/portal");
  revalidatePath(`/apply/portal/${data.id}`);
  return { applicationId: data.id };
}

/**
 * Fields the application wizard and the details form may write.
 *
 * `guardian_notes`, `student_summary` and `medical_notes` arrive from
 * hand-run migration 321 and are therefore absent from the generated
 * `database.ts` until types are regenerated. That is why the update below is
 * built as a plain record and the client narrowed, rather than typed from the
 * schema.
 */
const APPLICATION_DETAIL_FIELDS = [
  "previous_school",
  "emergency_contact_name",
  "emergency_contact_phone",
  "learning_needs_summary",
  "guardian_notes",
  "student_summary",
  "medical_notes",
] as const;

type LooseApplicationUpdater = {
  from: (table: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

/**
 * Save one wizard step — writing ONLY the fields that step actually submitted.
 *
 * THE BUG THIS FIXES. This function used to set all four columns on every
 * call, each read with `formData.get(...) || null`. The wizard renders one step
 * at a time, so the other steps' keys were simply absent from the submission,
 * `get()` returned null, and the update blanked them. A family who entered
 * their emergency contact on step 6 and then moved to step 7 lost the name and
 * the phone number, silently, behind a "Draft saved" toast.
 *
 * Steps 8, 9 and 10 carried hidden inputs echoing the existing values back —
 * evidence that somebody hit this and patched three of the eleven steps. The
 * presence check below fixes it for all of them, so those hidden inputs are no
 * longer load-bearing and have been removed from the component.
 *
 * `has()` rather than `get()` is the whole fix: a field the step did not render
 * is left alone, while a field the family deliberately cleared is written as
 * null. Those two cases are indistinguishable through `get()` and they must not
 * be treated the same.
 */
export async function saveApplicationDetails(formData: FormData) {
  const supabase = await createAuthClient();
  const applicationId = formData.get("application_id") as string;

  const update: Record<string, unknown> = { application_status: "in_progress" };
  for (const field of APPLICATION_DETAIL_FIELDS) {
    if (!formData.has(field)) continue;
    update[field] = (formData.get(field) as string)?.trim() || null;
  }

  const { error } = await (supabase as unknown as LooseApplicationUpdater)
    .from("admissions_applications")
    .update(update)
    .eq("id", applicationId);

  if (error) return { error: error.message };

  revalidatePath(`/apply/portal/${applicationId}`);
  return { success: true };
}

export async function registerApplicationDocument(formData: FormData) {
  const supabase = await createAuthClient();
  const user = await getLegacyUserFromAuthClient(supabase);

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

const ADMISSIONS_DOCUMENTS_BUCKET = "admissions-documents";

/**
 * Server-side document upload — storage + register.
 * Client components must not call Supabase storage directly.
 */
export async function uploadPortalDocument(formData: FormData) {
  const supabase = await createAuthClient();
  const user = await getLegacyUserFromAuthClient(supabase);
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "File is required" };
  }

  const applicationId = String(formData.get("application_id") ?? "");
  const documentType = String(formData.get("document_type") ?? "");
  const documentSubtype = (formData.get("document_subtype") as string) || null;
  const mode = String(formData.get("mode") ?? "application");
  const scholarshipApplicationId =
    (formData.get("scholarship_application_id") as string) || null;

  if (!applicationId || !documentType) {
    return { error: "application_id and document_type are required" };
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${applicationId}/${documentType}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(ADMISSIONS_DOCUMENTS_BUCKET)
    .upload(path, file, { upsert: false });

  if (uploadError) return { error: uploadError.message };

  const registerData = new FormData();
  registerData.set("application_id", applicationId);
  registerData.set("document_type", documentType);
  registerData.set("file_name", file.name);
  registerData.set("storage_path", path);
  registerData.set("mime_type", file.type);
  registerData.set("file_size_bytes", String(file.size));
  if (documentSubtype) registerData.set("document_subtype", documentSubtype);

  if (mode === "scholarship" && scholarshipApplicationId) {
    registerData.set("scholarship_application_id", scholarshipApplicationId);
    const scholarshipResult = await registerScholarshipDocument(registerData);
    if (!scholarshipResult.error) {
      await mirrorPortalUploadToKnowledge({
        supabase,
        userId: user.id,
        applicationId,
        documentType,
        file,
      });
    }
    return scholarshipResult;
  }

  const registerResult = await registerApplicationDocument(registerData);
  if (!registerResult.error) {
    await mirrorPortalUploadToKnowledge({
      supabase,
      userId: user.id,
      applicationId,
      documentType,
      file,
    });
  }
  return registerResult;
}

/** KnowledgeEngine owns document content; admissions tables keep CRM status. */
async function mirrorPortalUploadToKnowledge(input: {
  supabase: Awaited<ReturnType<typeof createAuthClient>>;
  userId: string;
  applicationId: string;
  documentType: string;
  file: File;
}) {
  try {
    const { data: application } = await input.supabase
      .from("admissions_applications")
      .select("lead_id, admissions_leads(school_id, schools(organization_id))")
      .eq("id", input.applicationId)
      .maybeSingle();

    const lead = application?.admissions_leads as
      | { school_id?: string; schools?: { organization_id?: string } | null }
      | { school_id?: string; schools?: { organization_id?: string } | null }[]
      | null
      | undefined;
    const leadRow = Array.isArray(lead) ? lead[0] : lead;
    const organizationId = leadRow?.schools?.organization_id;
    if (!organizationId) return;

    const buf = Buffer.from(await input.file.arrayBuffer());
    const { linkAdmissionsDocumentToKnowledge } = await import(
      "@/lib/admissions/experience/knowledge-bridge"
    );
    await linkAdmissionsDocumentToKnowledge({
      organizationId,
      userId: input.userId,
      applicationId: input.applicationId,
      documentType: input.documentType,
      fileName: input.file.name,
      mimeType: input.file.type,
      content: buf.toString("base64"),
    });
  } catch {
    /* Knowledge mirror is best-effort; CRM registration already succeeded */
  }
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
  const auth = await assertAnyPermission("admissions.manage", "admissions.accept");
  if ("error" in auth) return { error: auth.error };

  const supabase = auth.supabase;
  const user = await getLegacyUserFromAuthClient(supabase);

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
  const user = await getLegacyUserFromAuthClient(supabase);

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
  const user = await getLegacyUserFromAuthClient(supabase);

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

  await transitionCaseStage(
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
  const user = await getLegacyUserFromAuthClient(supabase);

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
