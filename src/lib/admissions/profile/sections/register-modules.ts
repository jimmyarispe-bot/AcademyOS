import { registerProfileSectionModule } from "@/lib/platform/profile/sections";
import type { ProfileSectionComponent } from "@/lib/platform/profile/sections/types";
import { ADMISSIONS_CASE_PROFILE_SECTIONS } from "@/lib/admissions/profile/sections";

// Static imports only. These section views are "use client" modules; a dynamic
// import() from a Server Component yields the SSR module rather than a client
// reference, and rendering it throws "Attempted to call X() from the server but
// X is on the client." Static imports let the bundler emit proper client
// references. Client-side code splitting is still handled by Next.
import { OverviewSection } from "@/components/admissions/case/sections/OverviewSection";
import { ProspectSection } from "@/components/admissions/case/sections/ProspectSection";
import { StudentQuestionnaireSection } from "@/components/admissions/case/sections/StudentQuestionnaireSection";
import { PipelineSection } from "@/components/admissions/case/sections/PipelineSection";
import { ApplicationsSection } from "@/components/admissions/case/sections/ApplicationsSection";
import { DocumentsSection } from "@/components/admissions/case/sections/DocumentsSection";
import { VisitsSection } from "@/components/admissions/case/sections/VisitsSection";
import { CommunicationsSection } from "@/components/admissions/case/sections/CommunicationsSection";
import { TasksSection } from "@/components/admissions/case/sections/TasksSection";
import { ScholarshipsSection } from "@/components/admissions/case/sections/ScholarshipsSection";
import { DecisionsSection } from "@/components/admissions/case/sections/DecisionsSection";
import { EnrollmentSection } from "@/components/admissions/case/sections/EnrollmentSection";
import { NotesSection } from "@/components/admissions/case/sections/NotesSection";
import { ActivitySection } from "@/components/admissions/case/sections/ActivitySection";
import { RelationshipsSection } from "@/components/admissions/case/sections/RelationshipsSection";

const SECTION_VERSION = "1.0.0";

const SECTION_COMPONENTS: Record<string, ProfileSectionComponent> = {
  overview: OverviewSection,
  prospect: ProspectSection,
  student_questionnaire: StudentQuestionnaireSection,
  pipeline: PipelineSection,
  applications: ApplicationsSection,
  documents: DocumentsSection,
  visits: VisitsSection,
  communications: CommunicationsSection,
  tasks: TasksSection,
  scholarships: ScholarshipsSection,
  decisions: DecisionsSection,
  enrollment: EnrollmentSection,
  notes: NotesSection,
  activity: ActivitySection,
  relationships: RelationshipsSection,
};

/** Register all admissions case profile section modules. */
export function registerAdmissionsCaseProfileSectionModules(): void {
  for (const def of ADMISSIONS_CASE_PROFILE_SECTIONS) {
    const component = SECTION_COMPONENTS[def.key];
    if (!component) continue;

    registerProfileSectionModule({
      kind: "admissions_case",
      definition: {
        ...def,
        version: SECTION_VERSION,
        componentId: `admissions_case:${def.key}`,
      },
      component,
    });
  }
}
