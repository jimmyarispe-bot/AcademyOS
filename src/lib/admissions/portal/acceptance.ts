import type { createAuthClient } from "@/lib/supabase/server-auth";
import { transitionLeadStage } from "@/lib/admissions/workflow";
import { computeAdmissionsProgress } from "@/lib/admissions/portal/progress";
import type {
  PortalApplication,
  PortalApplicationDocument,
  PortalScholarshipApplication,
  PortalStateFundingVerification,
} from "@/lib/admissions/portal/queries";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface AcceptanceEvaluationInput {
  application: PortalApplication;
  documents: PortalApplicationDocument[];
  verifications: PortalStateFundingVerification[];
  scholarship: PortalScholarshipApplication | null;
  scholarshipDocuments: { document_type: string }[];
  fundingCodes: string[];
}

export function evaluateAcceptanceEligibility(input: AcceptanceEvaluationInput): {
  eligible: boolean;
  reason?: string;
} {
  const progress = computeAdmissionsProgress(input);

  if (input.application.application_status === "accepted") {
    return { eligible: false, reason: "Already accepted" };
  }

  if (!progress.readyForAutoAcceptance) {
    return { eligible: false, reason: "Application requirements incomplete" };
  }

  return { eligible: true };
}

export async function runAutomatedAcceptanceWorkflow(
  supabase: AuthClient,
  applicationId: string,
  changedBy: string | null,
  input: AcceptanceEvaluationInput
): Promise<{ accepted?: boolean; error?: string; reason?: string; studentId?: string }> {
  const evaluation = evaluateAcceptanceEligibility(input);
  if (!evaluation.eligible) {
    return { accepted: false, reason: evaluation.reason };
  }

  const now = new Date().toISOString();

  const { error: appError } = await supabase
    .from("admissions_applications")
    .update({
      application_status: "accepted",
      admissions_decision_date: now.split("T")[0],
      accepted_by_user_id: changedBy,
    })
    .eq("id", applicationId);

  if (appError) return { error: appError.message };

  const stageResult = await transitionLeadStage(
    supabase,
    input.application.lead_id,
    "accepted",
    changedBy
  );

  if (stageResult.error) return { error: stageResult.error };

  const { convertAcceptedApplicantToStudent } = await import("@/lib/sis/conversion");
  const conversion = await convertAcceptedApplicantToStudent(supabase, {
    applicationId,
    leadId: input.application.lead_id,
    convertedBy: changedBy,
    source: "portal",
  });

  if (!conversion.success && !conversion.alreadyExists) {
    return { error: conversion.error ?? "Failed to create student record" };
  }

  return { accepted: true, studentId: conversion.studentId };
}
