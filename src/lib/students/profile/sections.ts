import { getStudentActivityFeed, getAuditActivity } from "@/lib/platform/activity";
import type { ProfileEnvelopeBase, ProfileSectionDefinition } from "@/lib/platform/profile/types";
import { studentFromContext, summaryFromContext } from "@/lib/students/profile/section-context";
import type { StudentProfileEnvelope } from "@/lib/students/profile/types";
import { isStudentProfileEnvelope } from "@/lib/students/profile/types";

function studentEnvelope(envelope: ProfileEnvelopeBase): StudentProfileEnvelope | null {
  return isStudentProfileEnvelope(envelope) ? envelope : null;
}

function section(partial: ProfileSectionDefinition): ProfileSectionDefinition {
  return partial;
}

/** Student profile section definitions (loaders + metadata). Components registered via register-modules. */
export const STUDENT_PROFILE_SECTIONS: ProfileSectionDefinition[] = [
  section({
    key: "overview",
    label: "Overview",
    group: null,
    pinned: true,
    sortOrder: 0,
    moduleKey: "platform",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope, ctx) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentById, getEnrollmentsByStudent } = await import("@/lib/students/queries");
      const { getStudentExecutiveSummary } = await import("@/lib/ssis/queries");
      const { getStudentConversion } = await import("@/lib/sis/queries");
      const student =
        studentFromContext(ctx) ?? (await getStudentById(env.studentId));
      if (!student) return null;
      const summary =
        summaryFromContext(ctx) ??
        (await getStudentExecutiveSummary(env.studentId));
      const [enrollments, conversion] = await Promise.all([
        getEnrollmentsByStudent(env.studentId),
        getStudentConversion(env.studentId),
      ]);
      return { student, summary, enrollments, conversion };
    },
  }),
  section({
    key: "identity",
    label: "Identity",
    group: "core",
    sortOrder: 10,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentById } = await import("@/lib/students/queries");
      const { getEntityTags } = await import("@/lib/platform/tags");
      const student = await getStudentById(env.studentId);
      const tags = env.organizationId
        ? await getEntityTags(supabase, "student", env.studentId)
        : [];
      return { student, tags };
    },
  }),
  section({
    key: "admissions",
    label: "Admissions",
    group: "core",
    sortOrder: 20,
    moduleKey: "admissions",
    permissions: ["students.view", "admissions.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentConversion } = await import("@/lib/sis/queries");
      return getStudentConversion(env.studentId);
    },
  }),
  section({
    key: "enrollment",
    label: "Enrollment",
    group: "core",
    sortOrder: 30,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getEnrollmentsByStudent, getStudentById } = await import("@/lib/students/queries");
      const { getStudentLifecycleHistory } = await import("@/lib/ssis/transitions");
      const { getStudentConversion } = await import("@/lib/sis/queries");
      const [student, enrollments, conversion] = await Promise.all([
        getStudentById(env.studentId),
        getEnrollmentsByStudent(env.studentId),
        getStudentConversion(env.studentId),
      ]);
      const lifecycleHistory = await getStudentLifecycleHistory(supabase, env.studentId);
      const { loadStudentGradeHistory } = await import("@/lib/students/profile/queries");
      const gradeHistory = await loadStudentGradeHistory(supabase, env.studentId);
      return { student, enrollments, conversion, lifecycleHistory, gradeHistory };
    },
  }),
  section({
    key: "academics",
    label: "Academics",
    group: "learning",
    sortOrder: 40,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentAcademicProfile, getStudentSpedPlans } = await import("@/lib/sis/queries");
      const [academic, spedPlans] = await Promise.all([
        getStudentAcademicProfile(env.studentId),
        getStudentSpedPlans(env.studentId),
      ]);
      return { academic, spedPlans };
    },
  }),
  section({
    key: "learning-journey",
    label: "Learning Journey",
    group: "learning",
    sortOrder: 45,
    moduleKey: "paj",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { loadStudentLearningJourney } = await import("@/lib/students/profile/queries");
      return loadStudentLearningJourney(supabase, env.studentId);
    },
  }),
  section({
    key: "graduation-readiness",
    label: "Graduation Readiness",
    group: "learning",
    sortOrder: 55,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { loadStudentGraduationReadiness } = await import("@/lib/students/profile/queries");
      return loadStudentGraduationReadiness(supabase, env.studentId, env.schoolId);
    },
  }),
  section({
    key: "progress",
    label: "Progress Monitoring",
    group: "learning",
    sortOrder: 50,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "partial",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentAcademicProfile } = await import("@/lib/sis/queries");
      const academic = await getStudentAcademicProfile(env.studentId);
      return {
        goals: academic.goals,
        interventions: academic.interventions,
        profile: academic.profile,
      };
    },
  }),
  section({
    key: "map-nwea",
    label: "MAP / NWEA",
    group: "learning",
    sortOrder: 60,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "placeholder",
    loadData: async () => ({ connectorKey: "nwea_map", results: [] }),
  }),
  section({
    key: "attendance",
    label: "Attendance",
    group: "student_life",
    sortOrder: 70,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope, ctx) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentAttendance } = await import("@/lib/sis/queries");
      const { getStudentExecutiveSummary } = await import("@/lib/ssis/queries");
      const { getStudentById } = await import("@/lib/students/queries");
      const student = studentFromContext(ctx) ?? (await getStudentById(env.studentId));
      const [records, summary] = await Promise.all([
        getStudentAttendance(env.studentId),
        summaryFromContext(ctx) ??
          (student
            ? getStudentExecutiveSummary(env.studentId)
            : Promise.resolve(null)),
      ]);
      return { records, summary };
    },
  }),
  section({
    key: "behavior",
    label: "Behavior",
    group: "student_life",
    sortOrder: 80,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope, ctx) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentBehavior } = await import("@/lib/sis/queries");
      const { getStudentExecutiveSummary } = await import("@/lib/ssis/queries");
      const { getStudentById } = await import("@/lib/students/queries");
      const student = studentFromContext(ctx) ?? (await getStudentById(env.studentId));
      const [events, summary] = await Promise.all([
        getStudentBehavior(env.studentId),
        summaryFromContext(ctx) ??
          (student
            ? getStudentExecutiveSummary(env.studentId)
            : Promise.resolve(null)),
      ]);
      return { events, summary };
    },
  }),
  section({
    key: "scheduling",
    label: "Scheduling",
    group: "student_life",
    sortOrder: 90,
    moduleKey: "scheduling",
    permissions: ["students.view"],
    status: "partial",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentSchedule } = await import("@/lib/scheduling/queries");
      const { loadStudentGradeHistory } = await import("@/lib/students/profile/queries");
      const [schedule, gradeHistory] = await Promise.all([
        getStudentSchedule(env.studentId),
        loadStudentGradeHistory(supabase, env.studentId),
      ]);

      let platformOccurrences: Array<{
        id: string;
        title: string;
        eventType: string;
        startsAt: string;
        endsAt: string;
      }> = [];
      try {
        const { getStudentSchedule: getPlatformStudentSchedule } = await import(
          "@/lib/calendar/queries"
        );
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 30 * 86400000).toISOString();
        const rows = await getPlatformStudentSchedule(env.studentId, from, to);
        platformOccurrences = rows.map((o) => ({
          id: `${o.id}:${o.occurrenceStartsAt}`,
          title: o.title,
          eventType: o.event_type,
          startsAt: o.occurrenceStartsAt,
          endsAt: o.occurrenceEndsAt,
        }));
      } catch {
        platformOccurrences = [];
      }

      return {
        ...schedule,
        courseEnrollments: gradeHistory.courseEnrollments,
        platformOccurrences,
        studentId: env.studentId,
      };
    },
  }),
  section({
    key: "teachers",
    label: "Teachers & Team",
    group: "student_life",
    sortOrder: 95,
    moduleKey: "instruction",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { loadStudentInstructionalTeam } = await import("@/lib/students/profile/queries");
      return loadStudentInstructionalTeam(supabase, env.studentId);
    },
  }),
  section({
    key: "special-ed",
    label: "Special Education",
    group: "support",
    sortOrder: 100,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope, ctx) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentSpedPlans } = await import("@/lib/sis/queries");
      const { getStudentExecutiveSummary } = await import("@/lib/ssis/queries");
      const { getStudentById } = await import("@/lib/students/queries");
      const student = studentFromContext(ctx) ?? (await getStudentById(env.studentId));
      const [plans, summary] = await Promise.all([
        getStudentSpedPlans(env.studentId),
        summaryFromContext(ctx) ??
          (student
            ? getStudentExecutiveSummary(env.studentId)
            : Promise.resolve(null)),
      ]);
      return { plans, reviewDue: summary?.spedReviewDue ?? false };
    },
  }),
  section({
    key: "therapy",
    label: "Therapy Services",
    group: "support",
    sortOrder: 110,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentServices } = await import("@/lib/sis/queries");
      return getStudentServices(env.studentId);
    },
  }),
  section({
    key: "medical",
    label: "Medical",
    group: "support",
    sortOrder: 120,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope, ctx) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentMedicalProfile } = await import("@/lib/sis/queries");
      const { getStudentExecutiveSummary } = await import("@/lib/ssis/queries");
      const { getStudentById } = await import("@/lib/students/queries");
      const student = studentFromContext(ctx) ?? (await getStudentById(env.studentId));
      const [medical, summary] = await Promise.all([
        getStudentMedicalProfile(env.studentId),
        summaryFromContext(ctx) ??
          (student
            ? getStudentExecutiveSummary(env.studentId)
            : Promise.resolve(null)),
      ]);
      return { medical, alertCount: summary?.medicalAlertCount ?? 0 };
    },
  }),
  section({
    key: "family",
    label: "Family & Guardians",
    group: "support",
    sortOrder: 130,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getGuardiansByFamily, getStudentById, searchFamilies } = await import(
        "@/lib/students/queries"
      );
      const {
        getStudentAuthorizedContacts,
      } = await import("@/lib/sis/queries");
      const { getFamilyHouseholds, getStudentSiblings } = await import("@/lib/ssis/family");
      const { getStudentRelationships } = await import("@/lib/platform/relationships");
      const familyId = env.familyId;
      const canManageFamily =
        env.permissions.includes("families.manage") || env.permissions.includes("students.edit");
      const [student, guardians, authorizedContacts, siblings, households, relationships, families] =
        await Promise.all([
          getStudentById(env.studentId),
          familyId ? getGuardiansByFamily(familyId) : Promise.resolve([]),
          getStudentAuthorizedContacts(env.studentId),
          getStudentSiblings(env.studentId),
          familyId ? getFamilyHouseholds(familyId) : Promise.resolve([]),
          getStudentRelationships(supabase, env.studentId),
          env.schoolId ? searchFamilies(env.schoolId, "", 100) : Promise.resolve([]),
        ]);
      return {
        student,
        guardians,
        authorizedContacts,
        siblings,
        households,
        relationships,
        families,
        canManageFamily,
      };
    },
  }),
  section({
    key: "billing",
    label: "Tuition & Billing",
    group: "financial",
    sortOrder: 140,
    moduleKey: "finance",
    permissions: ["students.view", "finance.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env?.familyId) return { profile: null, message: "No family billing account linked" };
      const { loadStudentBillingSnapshot } = await import("@/lib/students/profile/queries");
      const profile = await loadStudentBillingSnapshot(supabase, env.familyId, env.studentId);
      return { profile, studentId: env.studentId };
    },
  }),
  section({
    key: "scholarships",
    label: "Scholarships",
    group: "financial",
    sortOrder: 150,
    moduleKey: "scholarships",
    permissions: ["students.view", "scholarships.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentFundingCenter } = await import("@/lib/ssis/queries");
      const funding = await getStudentFundingCenter(supabase, env.studentId);
      const scholarships = (funding ?? []).filter(
        (r: Record<string, unknown>) =>
          String(r.funding_category ?? "").includes("scholarship")
      );
      return { funding, scholarships };
    },
  }),
  section({
    key: "transportation",
    label: "Transportation",
    group: "operations",
    sortOrder: 160,
    moduleKey: "transportation",
    permissions: ["students.view"],
    status: "partial",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentRelationships } = await import("@/lib/platform/relationships");
      const routes = await getStudentRelationships(supabase, env.studentId, {
        relationshipType: "student.transportation_route",
      });
      return { routes };
    },
  }),
  section({
    key: "documents",
    label: "Documents",
    group: "operations",
    sortOrder: 170,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentDocuments, getStudentConversion } = await import("@/lib/sis/queries");
      const [documents, conversion] = await Promise.all([
        getStudentDocuments(env.studentId),
        getStudentConversion(env.studentId),
      ]);
      return { documents, conversion };
    },
  }),
  section({
    key: "compliance",
    label: "Compliance",
    group: "operations",
    sortOrder: 180,
    moduleKey: "compliance",
    permissions: ["students.view", "compliance.view"],
    status: "partial",
    loadData: async () => ({
      obligations: [],
      message: "Student-scoped compliance obligations — full integration in Phase 2B",
    }),
  }),
  section({
    key: "notes",
    label: "Notes",
    group: "operations",
    sortOrder: 185,
    moduleKey: "platform",
    permissions: ["students.view"],
    status: "live",
    /**
     * Somewhere for a member of staff to write down what they know.
     *
     * The student profile had twenty-five sections and no notes. Admissions
     * has had them all along, so everything learned about a child during
     * admissions stopped at the point they enrolled — and a teacher or school
     * leader had nowhere to put what they learned afterwards.
     *
     * Platform notes rather than a second notes table: keyed on
     * (entity_type, entity_id), so the same rows and the same panel serve a
     * student, an employee or a family, and a note keeps its author, its
     * category and its pin wherever it is read.
     */
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getEntityNotes } = await import("@/lib/platform/notes");
      const notes = await getEntityNotes(supabase, "student", env.studentId, {
        pinnedFirst: true,
      });
      return {
        notes,
        organizationId: env.organizationId,
        schoolId: env.schoolId,
        studentId: env.studentId,
        familyId: env.familyId,
      };
    },
  }),
  section({
    key: "communications",
    label: "Communications",
    group: "intelligence",
    sortOrder: 190,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    activityClassification: "communication",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentCommunicationTimeline } = await import("@/lib/communications/timeline");
      const [activity, platformCommunications] = await Promise.all([
        getStudentActivityFeed(supabase, env.studentId, {
          classification: "communication",
        }),
        getStudentCommunicationTimeline(supabase, env.studentId, 40),
      ]);
      return {
        activity,
        platformCommunications,
        studentId: env.studentId,
        familyId: env.familyId ?? null,
      };
    },
  }),
  section({
    key: "parent-engagement",
    label: "Parent Engagement",
    group: "intelligence",
    sortOrder: 195,
    moduleKey: "ssis",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getParentEngagementSummary } = await import("@/lib/ssis/engagement");
      return getParentEngagementSummary(supabase, env.studentId);
    },
  }),
  section({
    key: "ai-insights",
    label: "AI Insights",
    group: "intelligence",
    sortOrder: 200,
    moduleKey: "decision_intelligence",
    permissions: ["students.view"],
    status: "partial",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { loadStudentGraduationReadiness } = await import("@/lib/students/profile/queries");
      return loadStudentGraduationReadiness(supabase, env.studentId, env.schoolId);
    },
  }),
  section({
    key: "timeline",
    label: "Timeline",
    group: "system",
    sortOrder: 210,
    moduleKey: "platform",
    permissions: ["students.view"],
    status: "live",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      const { getStudentCommunicationTimeline } = await import("@/lib/ssis/timeline");
      const [activity, communications] = await Promise.all([
        getStudentActivityFeed(supabase, env.studentId),
        getStudentCommunicationTimeline(supabase, env.studentId, { limit: 50 }),
      ]);
      const commEvents = communications.map((c) => ({
        id: c.id as string,
        organization_id: null,
        school_id: (c.school_id as string | null) ?? null,
        campus_id: null,
        module_key: "ssis",
        event_type: "ssis.communication",
        event_version: "1",
        entity_type: "students",
        entity_id: env.studentId,
        title: c.subject as string,
        summary: c.subject as string,
        body: c.body as string,
        actor_user_id: (c.actor_user_id as string | null) ?? null,
        actor_type: "user" as const,
        occurred_at: c.occurred_at as string,
        student_id: env.studentId,
        family_id: null,
        related_entity_type: (c.related_entity_type as string | null) ?? null,
        related_entity_id: (c.related_entity_id as string | null) ?? null,
        classification: "communication" as const,
        visibility: "staff" as const,
        severity: null,
        payload: { channel: c.channel, direction: c.direction },
        correlation_id: null,
        source_table: "ssis_communication_events",
        source_id: c.id as string,
        searchable_text: `${c.subject} ${c.body}`,
        created_at: c.occurred_at as string,
      }));
      const merged = [...activity, ...commEvents].sort(
        (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      );
      return merged.slice(0, 100);
    },
  }),
  section({
    key: "audit",
    label: "Audit History",
    group: "system",
    sortOrder: 220,
    moduleKey: "platform",
    permissions: ["students.view", "audit.view_all"],
    status: "partial",
    loadData: async (supabase, envelope) => {
      const env = studentEnvelope(envelope);
      if (!env) return null;
      return getAuditActivity(supabase, { studentId: env.studentId });
    },
  }),
];
