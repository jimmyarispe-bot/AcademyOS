import { ProfileSectionPlaceholder } from "@/components/platform/profile-workspace/ProfileSectionPlaceholder";
import type { ProfileSectionViewProps } from "@/lib/platform/profile/sections/types";

import { OverviewSection } from "./OverviewSection";
import { ProspectSection } from "./ProspectSection";
import { StudentQuestionnaireSection } from "./StudentQuestionnaireSection";
import { PipelineSection } from "./PipelineSection";
import { ApplicationsSection } from "./ApplicationsSection";
import { DocumentsSection } from "./DocumentsSection";
import { VisitsSection } from "./VisitsSection";
import { CommunicationsSection } from "./CommunicationsSection";
import { TasksSection } from "./TasksSection";
import { ScholarshipsSection } from "./ScholarshipsSection";
import { DecisionsSection } from "./DecisionsSection";
import { EnrollmentSection } from "./EnrollmentSection";
import { NotesSection } from "./NotesSection";
import { ActivitySection } from "./ActivitySection";
import { RelationshipsSection } from "./RelationshipsSection";

/**
 * Static section switch — client boundaries must be statically analyzable.
 *
 * Resolving a "use client" section through the runtime module registry gives
 * the RSC renderer a value it cannot link to a client boundary, so it invokes
 * the client-reference proxy and throws "Attempted to call X() from the server
 * but X is on the client". Server-component sections were unaffected, which is
 * why only the client sections failed, and only in a production build.
 *
 * THE COST OF THAT IS THIS FILE. A section now has to be added in two places —
 * the definition in `ADMISSIONS_CASE_PROFILE_SECTIONS`, and a case here — and
 * doing only the first produces a tab that renders "Section module is not
 * registered", which is a sentence no member of staff can act on. That is
 * exactly how the Student Questionnaire shipped.
 *
 * `tests/unit/admissions/case-sections-registered.test.ts` now reads both lists
 * and fails when they disagree, so the next person only has to be reminded
 * once.
 */
export function AdmissionsCaseSectionSwitch(props: ProfileSectionViewProps) {
  switch (props.sectionKey) {
    case "overview":
      return <OverviewSection {...props} />;
    case "prospect":
      return <ProspectSection {...props} />;
    case "student_questionnaire":
      return <StudentQuestionnaireSection {...props} />;
    case "pipeline":
      return <PipelineSection {...props} />;
    case "applications":
      return <ApplicationsSection {...props} />;
    case "documents":
      return <DocumentsSection {...props} />;
    case "visits":
      return <VisitsSection {...props} />;
    case "communications":
      return <CommunicationsSection {...props} />;
    case "tasks":
      return <TasksSection {...props} />;
    case "scholarships":
      return <ScholarshipsSection {...props} />;
    case "decisions":
      return <DecisionsSection {...props} />;
    case "enrollment":
      return <EnrollmentSection {...props} />;
    case "notes":
      return <NotesSection {...props} />;
    case "activity":
      return <ActivitySection {...props} />;
    case "relationships":
      return <RelationshipsSection {...props} />;
    default:
      return (
        <ProfileSectionPlaceholder
          title={props.sectionKey}
          status="placeholder"
          description="Section module is not registered."
        />
      );
  }
}
