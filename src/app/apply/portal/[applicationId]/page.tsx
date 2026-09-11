import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import { ApplyShell } from "@/components/admissions/portal/ApplyShell";
import { ActionChip } from "@/components/ui/cta";
import { AdmissionsProgressMeter } from "@/components/admissions/portal/AdmissionsProgressMeter";
import { FinancialAidSection } from "@/components/admissions/portal/FinancialAidSection";
import { StateFundingVerificationPanel } from "@/components/admissions/portal/StateFundingVerification";
import { SubmitApplicationButton } from "@/components/admissions/portal/SubmitApplicationButton";
import {
  ApplicationStatusChip,
  ApplicationStatusLegend,
} from "@/components/admissions/experience/ApplicationStatusChip";
import { ContractsPanel } from "@/components/admissions/experience/ContractsPanel";
import { ListSkeleton } from "@/components/experience-system";
import Link from "next/link";

/** P010 — Document Center is a large client island; load only on this portal route. */
const ApplicationDetailsForm = dynamic(
  () =>
    import("@/components/admissions/portal/DocumentCenter").then((m) => ({
      default: m.ApplicationDetailsForm,
    })),
  { ssr: true, loading: () => <ListSkeleton rows={4} label="Loading application details…" /> }
);
const DocumentCenter = dynamic(
  () =>
    import("@/components/admissions/portal/DocumentCenter").then((m) => ({
      default: m.DocumentCenter,
    })),
  { ssr: true, loading: () => <ListSkeleton rows={6} label="Loading documents…" /> }
);
const FinancialAidDocumentCenter = dynamic(
  () =>
    import("@/components/admissions/portal/DocumentCenter").then((m) => ({
      default: m.FinancialAidDocumentCenter,
    })),
  { ssr: true, loading: () => <ListSkeleton rows={4} label="Loading financial aid docs…" /> }
);
import { getSessionUser } from "@/lib/auth/session";
import { computeAdmissionsProgress } from "@/lib/admissions/portal/progress";
import {
  requiresFinancialAid,
  requiresStateFundingVerification,
} from "@/lib/constants/admissions-portal";
import { programLabel } from "@/lib/constants/programs";
import {
  getApplicationDocuments,
  getPortalApplication,
  getScholarshipDocuments,
  getScholarshipForApplication,
  getStateFundingVerifications,
} from "@/lib/admissions/portal/queries";

interface PortalApplicationPageProps {
  params: Promise<{ applicationId: string }>;
}

export default async function PortalApplicationPage({ params }: PortalApplicationPageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/login?next=/apply/portal");
  }

  const { applicationId } = await params;
  const portalData = await getPortalApplication(applicationId);
  if (!portalData) notFound();

  const { application, fundingCodes } = portalData;
  const lead = application.admissions_leads;

  const [documents, verifications, scholarship] = await Promise.all([
    getApplicationDocuments(applicationId),
    getStateFundingVerifications(applicationId),
    getScholarshipForApplication(applicationId),
  ]);

  const scholarshipDocuments = scholarship
    ? await getScholarshipDocuments(scholarship.id)
    : [];

  const progress = computeAdmissionsProgress({
    application,
    documents,
    verifications,
    scholarship,
    scholarshipDocuments,
    fundingCodes,
  });

  const showStateFunding = requiresStateFundingVerification(fundingCodes);
  const showFinancialAid = requiresFinancialAid(fundingCodes);
  const stateFundingDocs = documents.filter((d) => d.document_subtype === "state_funding");

  return (
    <ApplyShell userEmail={sessionUser.email}>
      <div className="space-y-6">
        <div>
          <ActionChip href="/apply/portal" size="sm" variant="ghost">
            Back to applications
          </ActionChip>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {lead ? `${lead.first_name} ${lead.last_name}` : "Application"}
            </h1>
            <ApplicationStatusChip
              applicationStatus={application.application_status}
              leadStage={lead && "lead_stage" in lead ? String(lead.lead_stage) : null}
            />
          </div>
          <p className="mt-1 text-slate-600">
            {lead?.schools?.name ?? "School"} · {programLabel(lead?.program ?? null)} ·{" "}
            {application.school_years?.name ?? "School Year"}
          </p>
          <ApplicationStatusLegend />
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link
              href={`/apply/portal/${applicationId}/wizard`}
              className="font-medium text-brand-700 underline"
            >
              Open multi-step application wizard
            </Link>
            <Link href="/admissions/onboarding" className="text-slate-600 underline">
              Parent onboarding
            </Link>
            <Link href="/apply/portal/finance" className="text-slate-600 underline">
              Tuition setup
            </Link>
          </div>
        </div>

        <AdmissionsProgressMeter progress={progress} />

        <ApplicationDetailsForm
          applicationId={applicationId}
          defaults={{
            previous_school: application.previous_school,
            emergency_contact_name: application.emergency_contact_name,
            emergency_contact_phone: application.emergency_contact_phone,
            learning_needs_summary: application.learning_needs_summary,
          }}
        />

        <DocumentCenter
          applicationId={applicationId}
          applicationDocuments={documents}
          stateFundingDocuments={stateFundingDocs}
          showStateFunding={showStateFunding}
        />

        {showStateFunding && (
          <StateFundingVerificationPanel
            applicationId={applicationId}
            leadId={application.lead_id}
            verifications={verifications}
          />
        )}

        {showFinancialAid && (
          <>
            <FinancialAidSection applicationId={applicationId} scholarship={scholarship} />
            {scholarship && (
              <FinancialAidDocumentCenter
                applicationId={applicationId}
                scholarshipApplicationId={scholarship.id}
                documents={scholarshipDocuments}
              />
            )}
          </>
        )}

        <SubmitApplicationButton
          applicationId={applicationId}
          progress={progress}
          applicationStatus={application.application_status}
        />

        {/* THE ENROLLMENT OFFER PANEL IS NOT HERE, AND MUST NOT COME BACK.
            This page is the applicant's. Its only guard is "somebody is signed
            in" — the row-level policies decide whose application it is, not
            this route — so anything rendered here is rendered to the family.

            Generating an enrollment offer is the school accepting a student.
            The button called generateEnrollmentPacket() directly, which is
            step 2 of the wf_accepted workflow, and stepping into the middle of
            that workflow skips step 1: the student_accepted communication. A
            packet appeared with packet_status 'sent' — a hardcoded literal in
            the insert — and no living person was told anything.

            Acceptance belongs on the staff case screen, where moving a lead to
            `accepted` runs all four steps in order: notify, generate packet,
            open the follow-up task, write the audit entry. */}

        <ContractsPanel
          applicationId={applicationId}
          leadId={application.lead_id}
        />
      </div>
    </ApplyShell>
  );
}
