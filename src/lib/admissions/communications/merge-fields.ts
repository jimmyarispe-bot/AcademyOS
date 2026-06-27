import { programLabel } from "@/lib/constants/programs";
import { fundingSourceLabels } from "@/lib/constants/programs";
import type { MergeField } from "@/lib/admissions/communications/types";

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
}

function studentName(ctx: MergeContext): string {
  if (ctx.preferredName) return ctx.preferredName;
  return `${ctx.studentFirstName ?? ""} ${ctx.studentLastName ?? ""}`.trim() || "your student";
}

function parentName(ctx: MergeContext): string {
  const name = `${ctx.guardianFirstName ?? ""} ${ctx.guardianLastName ?? ""}`.trim();
  return name || "Family";
}

function portalLink(ctx: MergeContext): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
