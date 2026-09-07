import { programLabel } from "@/lib/constants/programs";
import { fundingSourceLabels } from "@/lib/constants/programs";
import type { MergeField } from "@/lib/admissions/communications/types";
import { resolvePublicAppOrigin } from "@/lib/platform/branding";

export interface MergeContext {
  studentFirstName?: string | null;
  studentLastName?: string | null;
  preferredName?: string | null;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  schoolName?: string | null;
  program?: string | null;
  campusName?: string | null;
  campusAddress?: string | null;
  fundingSources?: string[];
  fundingProgram?: string | null;
  applicationId?: string | null;
  leadId?: string | null;
  tourDatetime?: string | null;
  interviewDatetime?: string | null;
  missingItems?: string[];
  missingDocuments?: string[];
  uploadedDocuments?: string[];
  awardAmount?: string | null;
  awardId?: string | null;
  stateStudentId?: string | null;
  rejectionReason?: string | null;
  customNotes?: string | null;
  deadline?: string | null;
  /**
   * The school's admissions contact, carried from `schools`.
   *
   * `schedulingUrl` is a public Google appointment-schedule link. Null is a
   * supported state and the caller picks a template that does not mention one —
   * see the note on `scheduling_link` below for why that matters.
   */
  admissionsContactName?: string | null;
  admissionsContactEmail?: string | null;
  schedulingUrl?: string | null;
  /**
   * Shadow-days booking link. Deliberately not the same as schedulingUrl: tours
   * and shadow days are different appointments with different lengths, and
   * sending a family to the wrong calendar at that point in the process is not a
   * small mistake.
   */
  shadowDaysUrl?: string | null;
  /**
   * The school's own From address. Not a merge field — nothing renders it into
   * a body — but it rides along here because this is the object the delivery
   * path already carries, and threading a parallel one would be two things to
   * keep in step instead of one.
   */
  fromEmail?: string | null;
}

function studentName(ctx: MergeContext): string {
  if (ctx.preferredName) return ctx.preferredName;
  return `${ctx.studentFirstName ?? ""} ${ctx.studentLastName ?? ""}`.trim() || "your student";
}

function parentName(ctx: MergeContext): string {
  const name = `${ctx.guardianFirstName ?? ""} ${ctx.guardianLastName ?? ""}`.trim();
  return name || "Family";
}

/**
 * A greeting wants a first name. Falls back through the full name to "there"
 * rather than to an empty string — "Hi ," is worse than slightly impersonal,
 * and an empty greeting is the kind of thing a parent notices and a test does
 * not.
 */
function guardianFirstName(ctx: MergeContext): string {
  return ctx.guardianFirstName?.trim() || parentName(ctx).split(" ")[0] || "there";
}

function studentFirstName(ctx: MergeContext): string {
  return (
    ctx.preferredName?.trim() ||
    ctx.studentFirstName?.trim() ||
    "your student"
  );
}

function portalLink(ctx: MergeContext): string {
  const base = resolvePublicAppOrigin();
  if (ctx.applicationId) return `${base}/apply/portal/${ctx.applicationId}`;
  return `${base}/apply/portal`;
}

function applicationLink(ctx: MergeContext): string {
  return portalLink(ctx);
}

function uploadLink(ctx: MergeContext): string {
  return portalLink(ctx);
}

export function buildMergeValues(ctx: MergeContext): Record<MergeField, string> {
  return {
    student_name: studentName(ctx),
    parent_name: parentName(ctx),
    parent_email: ctx.guardianEmail ?? "",
    parent_phone: ctx.guardianPhone ?? "",
    // See the note in types.ts. Live templates used these names before they
    // existed as fields; the context has carried the values all along.
    guardian_first_name: guardianFirstName(ctx),
    student_first_name: studentFirstName(ctx),
    guardian_name: parentName(ctx),
    guardian_email: ctx.guardianEmail ?? "",
    guardian_phone: ctx.guardianPhone ?? "",
    school_name: ctx.schoolName ?? "The Academy",
    program_name: programLabel(ctx.program),
    campus_name: ctx.campusName ?? "Main Campus",
    campus_address: ctx.campusAddress ?? "See portal for directions",
    parking_info: "Visitor parking is available at the main entrance.",
    funding_program: ctx.fundingProgram ?? "",
    funding_source: fundingSourceLabels(ctx.fundingSources).join(", ") || "—",
    portal_link: portalLink(ctx),
    application_link: applicationLink(ctx),
    upload_link: uploadLink(ctx),
    enrollment_link: portalLink(ctx),
    /**
     * Empty string rather than a placeholder when unset.
     *
     * `renderTemplate` leaves an *unknown* token in place as literal text, so a
     * template naming a field that does not exist mails a parent the characters
     * `{{scheduling_link}}`. A known field with no value at least renders as
     * nothing — but the real guard is upstream: the sender picks the no-link
     * template when the school has no booking URL, so this should never be
     * reached with an empty value on a link-bearing template.
     */
    scheduling_link: ctx.schedulingUrl ?? "",
    shadow_days_link: ctx.shadowDaysUrl ?? "",
    decisions_link: `${resolvePublicAppOrigin()}/dashboard/admissions/decisions`,
    admissions_contact_name: ctx.admissionsContactName ?? "Admissions",
    admissions_contact_email: ctx.admissionsContactEmail ?? "",
    lead_link: ctx.leadId
      ? `${resolvePublicAppOrigin()}/dashboard/admissions/leads/${ctx.leadId}`
      : `${resolvePublicAppOrigin()}/dashboard/people`,
    tour_datetime: ctx.tourDatetime ?? "",
    interview_datetime: ctx.interviewDatetime ?? "",
    missing_items: (ctx.missingItems ?? []).map((i) => `• ${i}`).join("\n") || "See portal for details",
    missing_documents: (ctx.missingDocuments ?? []).map((d) => `• ${d}`).join("\n") || "See portal",
    uploaded_documents: (ctx.uploadedDocuments ?? []).join(", ") || "",
    award_amount: ctx.awardAmount ?? "",
    award_id: ctx.awardId ?? "",
    state_student_id: ctx.stateStudentId ?? "",
    rejection_reason: ctx.rejectionReason ?? ctx.customNotes ?? "",
    next_steps: "Complete remaining checklist items in your Parent Portal.",
    requested_items: ctx.customNotes ?? (ctx.missingItems ?? []).join(", "),
    deadline: ctx.deadline ?? "Within 7 business days",
    decision_timeframe: "2–3 weeks",
    tuition_info: "Tuition details are available in your enrollment packet.",
    orientation_info: "Orientation details will be sent after enrollment is complete.",
    technology_info: "Technology setup instructions are in your enrollment packet.",
    waitlist_timeline: "We will update you monthly on waitlist status.",
    student_schedule: "Schedule available after enrollment is finalized.",
    teacher_assignment: "Teacher assignment pending enrollment completion.",
    first_day_info: "First day details will be sent before the start of school.",
    handbook_link: portalLink(ctx),
  };
}

export function renderTemplate(text: string, ctx: MergeContext): string {
  const values = buildMergeValues(ctx);
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return values[key as MergeField] ?? `{{${key}}}`;
  });
}
