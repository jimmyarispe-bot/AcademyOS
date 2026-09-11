import { notFound } from "next/navigation";
import { PersonDocumentsPanel } from "@/components/people/PersonDocumentsPanel";

import "@/lib/platform/profile";

import { StudentProfileWorkspace } from "@/components/students/profile/StudentProfileWorkspace";
import { loadProfileContextData } from "@/lib/platform/profile/page-context";
import { getStudentNotes } from "@/lib/platform/notes";
import { loadProfileSectionContributions } from "@/lib/platform/profile/sections";
import {
  loadStudentSectionData,
  resolveStudentProfile,
} from "@/lib/students/profile";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canManageStudentLifecycle } from "@/lib/students/lifecycle";
import { getStudentById } from "@/lib/students/queries";
import { getStudentExecutiveSummary } from "@/lib/ssis/queries";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { isStudentProfileEnvelope } from "@/lib/students/profile/types";

interface StudentDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string; tab?: string }>;
}

export default async function StudentDetailPage({ params, searchParams }: StudentDetailPageProps) {
  const { id } = await params;
  const { section, tab } = await searchParams;

  const supabase = await createAuthClient();
  const profile = await resolveStudentProfile(supabase, id, { section, tab });

  if (!profile) notFound();

  const envelope = profile.envelope;
  if (!isStudentProfileEnvelope(envelope)) notFound();

  const student = await getStudentById(id);
  if (!student) notFound();

  const activeSection = profile.activeSection;

  const summary = await getStudentExecutiveSummary(id);

  const [activeSectionData, contextData] = await Promise.all([
    loadStudentSectionData(supabase, envelope, activeSection, { student, summary }),
    loadProfileContextData(supabase, "student", id, envelope.organizationId, {
      loadRecentNotes: () => getStudentNotes(supabase, id, { limit: 10 }),
    }),
  ]);

  const sectionContributions = await loadProfileSectionContributions(
    "student",
    activeSection,
    supabase,
    envelope,
    activeSectionData
  );

  const notesForContext = contextData.notesForContext;
  const identity = await getIdentityContext();
  const canManageLifecycle = canManageStudentLifecycle(identity);

  return (
    <div className="space-y-6">
      <StudentProfileWorkspace
      envelope={envelope}
      navigation={profile.navigation}
      student={student}
      summary={summary}
      activeSection={activeSection}
      activeSectionData={activeSectionData}
      pinnedNotes={notesForContext}
      entityTags={contextData.entityTags}
      sectionContributions={sectionContributions}
      canManageLifecycle={canManageLifecycle}
      />
      {/* Transcripts, IEPs, medical forms, signed contracts. Gated on
          students.view / students.edit inside the panel's own actions. */}
      <PersonDocumentsPanel subjectType="student" subjectId={student.id} />
    </div>
  );
}
