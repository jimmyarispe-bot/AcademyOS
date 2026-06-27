import { notFound } from "next/navigation";
import Link from "next/link";
import { LeadDetail } from "@/components/admissions/LeadDetail";
import { StaffFundingVerificationPanel } from "@/components/admissions/StaffFundingVerificationPanel";
import { CommunicationTimeline } from "@/components/admissions/CommunicationTimeline";
import { DecisionWizard } from "@/components/admissions/DecisionWizard";
import { AdmissionsChecklistPanel } from "@/components/admissions/AdmissionsChecklistPanel";
import { EnrollmentPacketPanel } from "@/components/admissions/EnrollmentPacketPanel";
import { DuplicateWarningBanner } from "@/components/admissions/DuplicateWarningBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getLeadById,
  getLeadNotes,
  getLeadStageHistory,
  getLeadTasks,
  getLeadTours,
} from "@/lib/admissions/queries";
import {
  getLeadApplicationsForStaff,
  getStateFundingVerifications,
} from "@/lib/admissions/portal/queries";
import {
  getApplicantTimeline,
  getLeadCommunications,
  getPendingQueue,
} from "@/lib/admissions/communications/queries";
import { getApplicationChecklist } from "@/lib/admissions/checklist";
import { getEnrollmentPacket } from "@/lib/admissions/enrollment-packets";
import { detectDuplicates } from "@/lib/admissions/duplicates";
import { processCommunicationQueue } from "@/lib/admissions/communications/engine";
import { processWorkflowQueue } from "@/lib/admissions/automation/queue";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { StaffTimelinePanel } from "@/components/admissions/StaffTimelinePanel";
import { getStaffAuditTimeline } from "@/lib/admissions/automation/queries";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const supabase = await createAuthClient();
  await processWorkflowQueue(supabase);
  await processCommunicationQueue(supabase);

  const [lead, notes, tasks, tours, stageHistory, applications] = await Promise.all([
    getLeadById(id),
    getLeadNotes(id),
    getLeadTasks(id),
    getLeadTours(id),
    getLeadStageHistory(id),
    getLeadApplicationsForStaff(id),
  ]);

  if (!lead) notFound();

  const primaryApplication = applications[0];
  const [
    verifications,
    timeline,
    communications,
    pendingQueue,
    duplicates,
    checklist,
    enrollmentPacket,
    staffAudit,
  ] = await Promise.all([
    primaryApplication ? getStateFundingVerifications(primaryApplication.id) : Promise.resolve([]),
    getApplicantTimeline(id),
    getLeadCommunications(id),
    getPendingQueue(id),
    detectDuplicates({
      firstName: lead.first_name,
      lastName: lead.last_name,
      guardianEmail: lead.guardian_email,
      guardianPhone: lead.guardian_phone,
      dateOfBirth: lead.date_of_birth,
      excludeLeadId: id,
    }),
    primaryApplication ? getApplicationChecklist(primaryApplication.id) : Promise.resolve(null),
    primaryApplication ? getEnrollmentPacket(primaryApplication.id) : Promise.resolve(null),
    getStaffAuditTimeline(id),
  ]);

  const studentName = `${lead.first_name} ${lead.last_name}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={studentName}
        subtitle="Lead details, communications, and admissions workflow"
        backHref="/dashboard/admissions"
        actions={
          primaryApplication ? (
            <Link
              href={`/apply/portal/${primaryApplication.id}`}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View Portal
            </Link>
          ) : undefined
        }
      />

      <DuplicateWarningBanner matches={duplicates} />

      <LeadDetail lead={lead} notes={notes} tasks={tasks} tours={tours} stageHistory={stageHistory} />

      {primaryApplication && checklist && (
        <AdmissionsChecklistPanel
          applicationId={primaryApplication.id}
          leadId={id}
          items={checklist.items}
          percentComplete={checklist.percentComplete}
        />
      )}

      {primaryApplication && verifications.length > 0 && (
        <StaffFundingVerificationPanel
          applicationId={primaryApplication.id}
          leadId={id}
          verifications={verifications}
        />
      )}

      <DecisionWizard
        leadId={id}
        applicationId={primaryApplication?.id ?? null}
        studentName={studentName}
      />

      {enrollmentPacket && primaryApplication && (
        <EnrollmentPacketPanel
          packet={enrollmentPacket}
          applicationId={primaryApplication.id}
          signerEmail={lead.guardian_email ?? ""}
        />
      )}

      <CommunicationTimeline
        leadId={id}
        applicationId={primaryApplication?.id ?? null}
        guardianEmail={lead.guardian_email}
        timeline={timeline}
        communications={communications}
        pendingQueue={pendingQueue}
      />

      <StaffTimelinePanel entries={staffAudit} />
    </div>
  );
}
