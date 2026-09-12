import { registerProfileSectionModule } from "@/lib/platform/profile/sections";
import type { ProfileSectionComponent } from "@/lib/platform/profile/sections/types";
import { STUDENT_PROFILE_SECTIONS } from "@/lib/students/profile/sections";

const SECTION_VERSION = "1.0.0";

const SECTION_COMPONENT_LOADERS: Record<string, () => Promise<ProfileSectionComponent>> = {
  overview: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.OverviewSection
    ),
  identity: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.IdentitySection
    ),
  admissions: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.AdmissionsSection
    ),
  enrollment: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.EnrollmentSection
    ),
  academics: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.AcademicsSection
    ),
  "learning-journey": () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.LearningJourneySection
    ),
  "graduation-readiness": () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.GraduationReadinessSection
    ),
  progress: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.ProgressSection
    ),
  "map-nwea": () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.MapNweaSection
    ),
  attendance: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.AttendanceSection
    ),
  behavior: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.BehaviorSection
    ),
  scheduling: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.SchedulingSection
    ),
  teachers: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.TeachersSection
    ),
  "special-ed": () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.SpecialEdSection
    ),
  therapy: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.TherapySection
    ),
  medical: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.MedicalSection
    ),
  family: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.FamilySection
    ),
  billing: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.BillingSection
    ),
  scholarships: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.ScholarshipsSection
    ),
  transportation: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.TransportationSection
    ),
  documents: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.DocumentsSection
    ),
  compliance: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.ComplianceSection
    ),
  notes: () =>
    import("@/components/students/profile/sections/StudentNotesSection").then(
      (module) => module.StudentNotesSection
    ),
  communications: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.CommunicationsSection
    ),
  "parent-engagement": () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.ParentEngagementSection
    ),
  "ai-insights": () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.AiInsightsSection
    ),
  timeline: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.TimelineSection
    ),
  audit: () =>
    import("@/components/students/profile/sections/StudentSectionViews").then(
      (module) => module.AuditSection
    ),
};

/** Register all student profile section modules (metadata + loader + component). */
export function registerStudentProfileSectionModules(): void {
  for (const def of STUDENT_PROFILE_SECTIONS) {
    const componentLoader = SECTION_COMPONENT_LOADERS[def.key];
    if (!componentLoader) continue;

    registerProfileSectionModule({
      kind: "student",
      definition: {
        ...def,
        version: SECTION_VERSION,
        componentId: `student:${def.key}`,
      },
      componentLoader,
    });
  }
}
