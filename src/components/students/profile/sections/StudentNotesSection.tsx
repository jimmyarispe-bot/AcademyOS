import { EntityNotesPanel } from "@/components/platform/profile-sections/EntityNotesPanel";
import { ProfileCard, ProfileEmpty } from "@/components/platform/profile-workspace/ProfilePrimitives";
import type { ProfileSectionViewProps } from "@/lib/platform/profile/sections/types";
import type { PlatformNote } from "@/lib/platform/notes/types";

type NotesData = {
  notes: PlatformNote[];
  organizationId: string | null;
  schoolId: string | null;
  studentId: string;
  familyId: string | null;
};

/**
 * What staff know about this child, written down.
 *
 * The panel is the shared one rather than a student-specific copy: platform
 * notes are keyed on (entity_type, entity_id), so the same component serves an
 * employee or a family the day somebody asks for it, and a note keeps its
 * author, category and pin wherever it is read.
 *
 * An organization is required to write one — the notes table is scoped to it
 * and a row without one belongs to nobody. That should never happen on a real
 * student, but saying so is better than a save that fails with a database
 * error nobody can act on.
 */
export function StudentNotesSection(props: ProfileSectionViewProps) {
  const data = props.data as NotesData | null;

  if (!data) {
    return (
      <ProfileCard title="Notes">
        <ProfileEmpty>Notes are unavailable for this student.</ProfileEmpty>
      </ProfileCard>
    );
  }

  if (!data.organizationId) {
    return (
      <ProfileCard title="Notes">
        <ProfileEmpty>
          This student is not attached to an organization, so notes cannot be saved
          against them. Check the student record.
        </ProfileEmpty>
      </ProfileCard>
    );
  }

  return (
    <EntityNotesPanel
      organizationId={data.organizationId}
      schoolId={data.schoolId}
      entityType="student"
      entityId={data.studentId}
      studentId={data.studentId}
      familyId={data.familyId}
      notes={data.notes}
    />
  );
}
