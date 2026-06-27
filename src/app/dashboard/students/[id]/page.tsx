import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StudentDetailContent } from "@/components/students/StudentDetailContent";
import {
  getEnrollmentsByStudent,
  getGuardiansByFamily,
  getStudentById,
} from "@/lib/students/queries";
import {
  getStudentAcademicProfile,
  getStudentAttendance,
  getStudentAuthorizedContacts,
  getStudentBehavior,
  getStudentConversion,
  getStudentDocuments,
  getStudentMedicalProfile,
  getStudentServices,
  getStudentSpedPlans,
} from "@/lib/sis/queries";
import {
  aggregateStudentTimeline,
  getParentEngagementSummary,
  getStudentExecutiveSummary,
  getStudentFundingCenter,
} from "@/lib/ssis/queries";
import { getFamilyHouseholds, getStudentSiblings } from "@/lib/ssis/family";
import { getStudentLifecycleHistory } from "@/lib/ssis/transitions";
import { createAuthClient } from "@/lib/supabase/server-auth";

interface StudentDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function StudentDetailPage({ params, searchParams }: StudentDetailPageProps) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  const student = await getStudentById(id);
  if (!student) notFound();

  const supabase = await createAuthClient();
  const conversion = await getStudentConversion(id);

  const [
    summary,
    enrollments,
    guardians,
    authorizedContacts,
    medical,
    spedPlans,
    academic,
    attendance,
    behavior,
    services,
    documents,
    funding,
    engagement,
    timeline,
    siblings,
    households,
    lifecycleHistory,
  ] = await Promise.all([
    getStudentExecutiveSummary(id, student.admissions_lead_id),
    getEnrollmentsByStudent(id),
    student.family_id ? getGuardiansByFamily(student.family_id) : Promise.resolve([]),
    getStudentAuthorizedContacts(id),
    getStudentMedicalProfile(id),
    getStudentSpedPlans(id),
    getStudentAcademicProfile(id),
    getStudentAttendance(id),
    getStudentBehavior(id),
    getStudentServices(id),
    getStudentDocuments(id),
    getStudentFundingCenter(supabase, id),
    getParentEngagementSummary(supabase, id),
    aggregateStudentTimeline(supabase, id, student.admissions_lead_id),
    getStudentSiblings(id),
    student.family_id ? getFamilyHouseholds(student.family_id) : Promise.resolve([]),
    getStudentLifecycleHistory(supabase, id),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={`${student.first_name} ${student.last_name}`}
        subtitle="Student Success Information System (SSIS)"
        backHref="/dashboard/students"
      />

      <StudentDetailContent
        student={student}
        tab={tab}
        summary={summary}
        conversion={conversion}
        enrollments={enrollments}
        guardians={guardians}
        authorizedContacts={authorizedContacts}
        medical={medical}
        spedPlans={spedPlans}
        academic={academic}
        attendance={attendance}
        behavior={behavior}
        services={services}
        documents={documents}
        funding={funding}
        timeline={timeline}
        engagement={engagement}
        siblings={siblings}
        households={households}
        lifecycleHistory={lifecycleHistory}
      />
    </div>
  );
}
