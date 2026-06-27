import {
  APPLICATION_DOCUMENT_TYPES,
  FINANCIAL_AID_DOCUMENT_TYPES,
  PORTAL_PROGRESS_STEPS,
  requiresFinancialAid,
  requiresStateFundingVerification,
  type PortalProgressStepId,
} from "@/lib/constants/admissions-portal";
import type {
  PortalApplication,
  PortalApplicationDocument,
  PortalScholarshipApplication,
  PortalStateFundingVerification,
} from "@/lib/admissions/portal/queries";

export interface ProgressStepState {
  id: PortalProgressStepId;
  label: string;
  complete: boolean;
  current: boolean;
  optional: boolean;
}

export interface AdmissionsProgress {
  steps: ProgressStepState[];
  percentComplete: number;
  readyToSubmit: boolean;
  readyForAutoAcceptance: boolean;
}

function hasRequiredApplicationDocs(documents: PortalApplicationDocument[]): boolean {
  const uploaded = new Set(documents.map((d) => d.document_type));
  return APPLICATION_DOCUMENT_TYPES.filter((d) => d.required).every((d) =>
    uploaded.has(d.type)
  );
}

function hasRequiredStateFundingDocs(
  documents: PortalApplicationDocument[],
  fundingCodes: string[]
): boolean {
  if (!requiresStateFundingVerification(fundingCodes)) return true;
  const stateDocs = documents.filter((d) => d.document_subtype === "state_funding");
  const uploaded = new Set(stateDocs.map((d) => d.document_type));
  return ["esa_award_letter", "state_enrollment_form", "proof_of_residency"].every((t) =>
    uploaded.has(t)
  );
}

function hasRequiredFinancialAidDocs(
  scholarship: PortalScholarshipApplication | null,
  scholarshipDocs: { document_type: string }[]
): boolean {
  if (!scholarship) return false;
  const uploaded = new Set(scholarshipDocs.map((d) => d.document_type));
  return FINANCIAL_AID_DOCUMENT_TYPES.filter((d) => d.required).every((d) =>
    uploaded.has(d.type)
  );
}

function stateFundingVerified(
  verifications: PortalStateFundingVerification[],
  fundingCodes: string[]
): boolean {
  if (!requiresStateFundingVerification(fundingCodes)) return true;
  if (verifications.length === 0) return false;
  return verifications.every((v) => v.verification_status === "verified");
}

function applicationInfoComplete(application: PortalApplication): boolean {
  return Boolean(
    application.previous_school?.trim() &&
      application.emergency_contact_name?.trim() &&
      application.emergency_contact_phone?.trim()
  );
}

export function computeAdmissionsProgress(input: {
  application: PortalApplication;
  documents: PortalApplicationDocument[];
  verifications: PortalStateFundingVerification[];
  scholarship: PortalScholarshipApplication | null;
  scholarshipDocuments: { document_type: string }[];
  fundingCodes: string[];
}): AdmissionsProgress {
  const { application, documents, verifications, scholarship, scholarshipDocuments, fundingCodes } =
    input;

  const needsStateFunding = requiresStateFundingVerification(fundingCodes);
  const needsFinancialAid = requiresFinancialAid(fundingCodes);

  const inquiryComplete = true;
  const applicationComplete = applicationInfoComplete(application);
  const documentsComplete = hasRequiredApplicationDocs(documents);
  const stateDocsComplete = hasRequiredStateFundingDocs(documents, fundingCodes);
  const stateFundingComplete =
    needsStateFunding &&
    stateDocsComplete &&
    stateFundingVerified(verifications, fundingCodes);
  const financialAidComplete =
    needsFinancialAid &&
    scholarship != null &&
    ["submitted", "under_review", "approved"].includes(scholarship.scholarship_status) &&
    hasRequiredFinancialAidDocs(scholarship, scholarshipDocuments);

  const submitted = ["submitted", "under_review", "accepted", "waitlisted", "denied"].includes(
    application.application_status
  );
  const decided = ["accepted", "waitlisted", "denied", "enrolled"].includes(
    application.application_status
  ) || ["accepted", "waitlisted", "declined", "enrolled"].includes(application.lead_stage);

  const stepCompletion: Record<PortalProgressStepId, boolean> = {
    inquiry: inquiryComplete,
    application: applicationComplete,
    documents: documentsComplete && stateDocsComplete,
    state_funding: !needsStateFunding || Boolean(stateFundingComplete),
    financial_aid: !needsFinancialAid || Boolean(financialAidComplete),
    review: submitted,
    decision: decided,
  };

  const optionalSteps = new Set<PortalProgressStepId>(
    [
      !needsStateFunding ? "state_funding" : null,
      !needsFinancialAid ? "financial_aid" : null,
    ].filter(Boolean) as PortalProgressStepId[]
  );

  const activeSteps = PORTAL_PROGRESS_STEPS.filter((step) => {
    if (step.id === "state_funding" && !needsStateFunding) return false;
    if (step.id === "financial_aid" && !needsFinancialAid) return false;
    return true;
  });

  let currentFound = false;
  const steps: ProgressStepState[] = activeSteps.map((step) => {
    const complete = stepCompletion[step.id];
    const current = !currentFound && !complete;
    if (current) currentFound = true;
    return {
      id: step.id,
      label: step.label,
      complete,
      current,
      optional: optionalSteps.has(step.id),
    };
  });

  const requiredSteps = steps.filter((s) => !s.optional);
  const completedCount = requiredSteps.filter((s) => s.complete).length;
  const percentComplete = requiredSteps.length
    ? Math.round((completedCount / requiredSteps.length) * 100)
    : 0;

  const readyToSubmit =
    applicationComplete &&
    documentsComplete &&
    stateDocsComplete &&
    (!needsStateFunding || stateDocsComplete) &&
    (!needsFinancialAid ||
      (scholarship != null &&
        hasRequiredFinancialAidDocs(scholarship, scholarshipDocuments)));

  const readyForAutoAcceptance =
    readyToSubmit &&
    submitted &&
    stateFundingVerified(verifications, fundingCodes) &&
    (!needsFinancialAid ||
      (scholarship != null &&
        ["submitted", "under_review", "approved"].includes(scholarship.scholarship_status)));

  return {
    steps,
    percentComplete,
    readyToSubmit,
    readyForAutoAcceptance,
  };
}
