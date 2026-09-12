/**
 * Public Interest Form submit — org-resolved, version-validated, durable answers.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  EXPRESS_INTEREST_SUBMISSION_SOURCE,
  formDataToInterestValues,
  validateInterestSubmission,
} from "@/lib/admissions/interest-form/definition";
import { loadPublishedInterestForm } from "@/lib/admissions/interest-form/load";
import { resolveInterestFormOrganization } from "@/lib/admissions/interest-form/org-resolve";
import type {
  InterestFormValues,
  PublishedInterestForm,
} from "@/lib/admissions/interest-form/types";
import { recordInitialStage } from "@/lib/admissions/workflow";
import { onInquirySubmitted } from "@/lib/admissions/communications/triggers";
import type { GradeValue } from "@/lib/constants/grades";
import { allowedInterestProgramTypes } from "@/lib/admissions/interest-form/program-options";
import { parseFundingSourcesFromForm } from "@/lib/funding/helpers";
import {
  checkRateLimitAsync,
  getClientIpFromHeaders,
} from "@/lib/platform/api-rate-limit";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { setAutomationStartedAt } from "@/lib/admissions/automation-gate";
import { createServiceRoleClient } from "@/lib/supabase/server";

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Multiselect answers arrive as arrays. `String(["a","b"])` gives "a,b" — no
 * space, no way to tell a two-value answer from one value containing a comma.
 *
 * v3 made `referral_source` a multiselect while keeping its
 * `lead.referral_source` binding, so an array now reaches two text columns —
 * the lead's and the submission's. Joining explicitly is the difference between
 * a readable record and one that looks like a bug.
 *
 * The authoritative copy of the answer is still the array in
 * `admissions_interest_answers`; both text columns are conveniences.
 */
function asJoinedString(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => asString(entry)).filter(Boolean).join(", ");
  }
  return asString(value);
}

/**
 * Fold the answers that have no column of their own onto `lead.referral_source`.
 *
 * The authoritative copy of every answer is `admissions_interest_answers`; this
 * is the convenience copy, so that whoever opens the lead sees what the family
 * said without a second query.
 *
 * `learning_concerns` is still read for form versions published before the
 * question was split into greatness and challenges. Dropping it would lose the
 * answer from any org still on version 1.
 */
function encodeLeadReferralExtras(values: InterestFormValues): string | null {
  const referral = asJoinedString(values.referral_source);
  const preferred = asString(values.preferred_contact_method);
  const greatness = asString(values.student_greatness);
  const challenges = asString(values.student_challenges);
  const concerns = asString(values.learning_concerns);
  const parts = [
    referral,
    preferred ? `preferred_contact:${preferred}` : "",
    greatness ? `greatness:${greatness}` : "",
    challenges ? `challenges:${challenges}` : "",
    concerns ? `learning_concerns:${concerns}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}

async function verifyAntiSpam(formData: FormData): Promise<string | null> {
  const honeypot = asString(formData.get("company_website"));
  if (honeypot) return "Unable to submit inquiry.";

  const headerStore = await headers();
  const ip = getClientIpFromHeaders(headerStore);
  const limited = await checkRateLimitAsync(`admissions-inquiry:${ip}`, 5, 60_000);
  if (!limited.ok) return "Too many inquiries. Please try again later.";

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const token = asString(formData.get("cf-turnstile-response"));
    if (!token) return "Please complete the captcha.";
    try {
      const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: token,
          remoteip: ip,
        }),
      });
      const outcome = (await verify.json()) as { success?: boolean };
      if (!outcome.success) return "Captcha verification failed.";
    } catch {
      return "Captcha verification unavailable.";
    }
  }
  return null;
}

async function persistInterestSubmission(input: {
  organizationId: string;
  leadId: string;
  formId: string;
  formVersionId: string;
  source: string | null;
  referralSource: string | null;
  values: InterestFormValues;
}): Promise<{ submissionId: string } | { error: string }> {
  const admin = createServiceRoleClient();

  const { data: submission, error: submissionError } = await admin
    .from("admissions_interest_submissions" as never)
    .insert({
      organization_id: input.organizationId,
      lead_id: input.leadId,
      form_id: input.formId,
      form_version_id: input.formVersionId,
      submitted_at: new Date().toISOString(),
      source: input.source,
      referral_source: input.referralSource,
    } as never)
    .select("id")
    .single();

  if (submissionError || !submission) {
    return { error: submissionError?.message ?? "Unable to persist submission." };
  }

  const submissionId = (submission as { id: string }).id;
  const answerRows = Object.entries(input.values).map(([question_key, value]) => ({
    submission_id: submissionId,
    organization_id: input.organizationId,
    form_version_id: input.formVersionId,
    question_key,
    value: value === undefined ? null : value,
  }));

  if (answerRows.length) {
    const { error: answersError } = await admin
      .from("admissions_interest_answers" as never)
      .insert(answerRows as never);
    if (answersError) {
      return { error: answersError.message };
    }
  }

  return { submissionId };
}


/**
 * Attach the documents a family uploaded to the lead their inquiry created.
 *
 * The files are already in storage — the upload route put them there while the
 * parent was still filling the form in, under a quarantine prefix and a name
 * this server generated. What was missing until now is the record saying whose
 * they are.
 *
 * `application_documents.lead_id` comes from migration 326, which also rewrote
 * the staff read policy to resolve a school through the lead when there is no
 * application. Without that policy change a row inserted here would be
 * invisible to every member of staff — an upload that succeeded, reported
 * success, and was seen by nobody.
 *
 * The cast is narrow and deliberate: 326 is hand-run, so `lead_id` is absent
 * from the generated database types and `application_id` still reads as
 * non-nullable there. Naming only this insert keeps every other query in this
 * file type-checked.
 *
 * A failure here is logged, not thrown. The family's inquiry is already saved
 * and telling them it failed would be untrue; a document nobody can see is a
 * problem for staff to chase, not a reason to lose the lead.
 */
async function attachInquiryDocuments(input: {
  leadId: string;
  definition: PublishedInterestForm["definition"];
  values: InterestFormValues;
}): Promise<void> {
  const uploads = input.definition.questions
    .filter((question) => question.type === "file")
    .map((question) => ({
      question,
      path: typeof input.values[question.key] === "string"
        ? String(input.values[question.key]).trim()
        : "",
    }))
    .filter((entry) => entry.path !== "");

  if (!uploads.length) return;

  const admin = createServiceRoleClient();
  const { error } = await admin.from("application_documents").insert(
    uploads.map((entry) => ({
      lead_id: input.leadId,
      application_id: null,
      document_type: entry.question.key,
      document_status: "uploaded",
      file_name: entry.question.label.slice(0, 200),
      storage_path: entry.path,
    })) as never
  );

  if (error) {
    console.error("[interest-form] uploaded documents were not attached to the lead", {
      leadId: input.leadId,
      count: uploads.length,
      error: error.message,
    });
  }
}

/**
 * Submit Express Interest against the server-resolved published form.
 * Client-supplied organization_id / form ownership is ignored.
 */
export async function submitPublishedInterestForm(
  formData: FormData
): Promise<{ leadId: string; submissionId: string } | { error: string }> {
  const spamError = await verifyAntiSpam(formData);
  if (spamError) return { error: spamError };

  // Ignore client organization authority — host resolution only (fail closed).
  const org = await resolveInterestFormOrganization();
  if (!org) {
    return { error: "Unable to resolve organization for this inquiry." };
  }

  const published = await loadPublishedInterestForm({
    organizationId: org.organizationId,
    organizationName: org.organizationName,
  });
  if (!published) {
    return { error: "Interest form is not available." };
  }

  const values = formDataToInterestValues(formData);
  const schoolIds = new Set(published.schools.map((s) => s.id));
  const programCodes = allowedInterestProgramTypes();

  const validation = validateInterestSubmission({
    definition: published.definition,
    values,
    schoolIds,
    programCodesForSchool: programCodes,
    claimedFormVersionId: asString(formData.get("form_version_id")) || null,
    publishedFormVersionId: published.formVersionId,
  });

  if (!validation.ok) {
    return {
      error: validation.issues.map((i) => i.message).join(" "),
    };
  }

  const visible = validation.visibleValues;
  const fundingSources = parseFundingSourcesFromForm(formData);
  const referralForLead = encodeLeadReferralExtras(visible);

  const supabase = await createAuthClient();
  const { data, error } = await supabase.rpc("submit_public_admissions_inquiry", {
    p_school_id: asString(visible.school_id),
    p_first_name: asString(visible.first_name),
    p_last_name: asString(visible.last_name),
    p_preferred_name: asString(visible.preferred_name) || null,
    p_date_of_birth: asString(visible.date_of_birth) || null,
    p_current_grade: (asString(visible.current_grade) as GradeValue) || null,
    p_applying_for_grade: (asString(visible.applying_for_grade) as GradeValue) || null,
    // Multi-select is archived on interest answers; do not collapse onto lead.program.
    p_program: null,
    p_referral_source: referralForLead,
    p_guardian_first_name: asString(visible.guardian_first_name) || null,
    p_guardian_last_name: asString(visible.guardian_last_name) || null,
    p_guardian_email: asString(visible.guardian_email),
    p_guardian_phone: asString(visible.guardian_phone) || null,
    p_funding_source_codes: fundingSources.length
      ? fundingSources
      : Array.isArray(visible.funding_sources)
        ? (visible.funding_sources as string[])
        : [],
  });

  if (error) return { error: error.message };

  const leadId = data as string;
  // Post-RPC trusted server work: anon RLS cannot read admissions_leads.
  // Service role is scoped to this controlled server action; leadId comes from SECURITY DEFINER RPC.
  const admin = createServiceRoleClient();

  /**
   * A family who just filled in the public form has asked to hear from us, so
   * automated follow-up starts here and nowhere else.
   *
   * Every other route into `admissions_leads` — bulk import, staff "Add Lead" —
   * leaves `automation_started_at` NULL, and a human presses Start on the case
   * when they judge the family ready. That gate is what let the inquiry URLs go
   * on the websites without the reminder engine also chasing the 289 families
   * already in the database, 113 of whom had been parked since February.
   *
   * The error is checked rather than assumed. A refusal here is silent in
   * supabase-js, and a lead created but never opted in would simply never be
   * followed up — the quietest possible failure, and the one this whole gate
   * exists to make loud.
   */
  const { error: gateError } = await setAutomationStartedAt(
    admin,
    leadId,
    new Date().toISOString()
  );

  if (gateError) {
    console.error("[interest-form] could not enable automation for new lead", {
      leadId,
      error: gateError,
    });
  }

  await recordInitialStage(admin, leadId, null);
  await onInquirySubmitted(admin, leadId);

  await attachInquiryDocuments({
    leadId,
    definition: published.definition,
    values: visible,
  });

  const persisted = await persistInterestSubmission({
    organizationId: org.organizationId,
    leadId,
    formId: published.formId,
    formVersionId: published.formVersionId,
    // Server-owned submission metadata — do not trust arbitrary client source values.
    source: EXPRESS_INTEREST_SUBMISSION_SOURCE,
    referralSource: asJoinedString(visible.referral_source) || null,
    values: visible,
  });

  if ("error" in persisted) {
    // Lead already created — surface persistence failure without undoing CRM.
    console.error("[submitPublishedInterestForm] answers", persisted.error);
    return { error: "Inquiry received but submission archive failed. Please contact admissions." };
  }

  revalidatePath("/apply");
  return { leadId, submissionId: persisted.submissionId };
}
