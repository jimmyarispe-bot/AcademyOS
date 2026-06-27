import { StatCard } from "@/components/dashboard/StatCard";
import { TeacherTabsPanel } from "@/components/teacher/TeacherTabs";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCount } from "@/lib/format";
import { getIdentityContext } from "@/lib/platform/identity/context";
import {
  getAiReadinessConfig,
  getTeacherComplianceItems,
  getTeacherEmployeeId,
  getTeacherInterventions,
  getTeacherLessonPlans,
  getTeacherNotes,
  getTeacherOutreachHistory,
  getTeacherRosterStudents,
  getTeacherTodaySessions,
  getTeacherWorkloadSummary,
} from "@/lib/teacher/queries";
import { getCollaborationFeedForTeacher } from "@/lib/instruction/feed";
import { getInstructionalQualityMetrics, getSchoolInstructionalQualitySummary } from "@/lib/instruction/quality";
import { searchEvidenceLibrary } from "@/lib/instruction/evidence";
import { getSessionReadinessForStudents } from "@/lib/instruction/readiness";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getTeacherDocumentationDeadlines } from "@/lib/compliance/deadlines";

export const TEACHER_TABS = [
  { href: "/dashboard/teacher?view=my-day", label: "My Day", value: "my-day", permission: null },
  { href: "/dashboard/teacher?view=workload", label: "Workload", value: "workload", permission: null },
  { href: "/dashboard/teacher?view=progress", label: "Progress", value: "progress", permission: null },
  { href: "/dashboard/teacher?view=lessons", label: "Lesson Plans", value: "lessons", permission: null },
  { href: "/dashboard/teacher?view=notes", label: "Notes", value: "notes", permission: null },
  { href: "/dashboard/teacher?view=interventions", label: "Interventions", value: "interventions", permission: null },
  { href: "/dashboard/teacher?view=parent-comm", label: "Parent Comm", value: "parent-comm", permission: null },
  { href: "/dashboard/teacher?view=artifacts", label: "Artifacts", value: "artifacts", permission: null },
  { href: "/dashboard/teacher?view=collaboration", label: "Collaboration", value: "collaboration", permission: "instruction.team" },
  { href: "/dashboard/teacher?view=quality", label: "Quality", value: "quality", permission: "instruction.quality" },
  { href: "/dashboard/teacher?view=compliance", label: "Compliance", value: "compliance", permission: null },
  { href: "/dashboard/teacher/executive", label: "Executive", value: "executive", permission: "instruction.executive" },
  { href: "/dashboard/teacher?view=ai-readiness", label: "AI Readiness", value: "ai-readiness", permission: null },
] as const;

interface TeacherPageContentProps {
  searchParams: Promise<{
    view?: string;
    q?: string;
    artifact_type?: string;
    subject_domain?: string;
    date_from?: string;
    date_to?: string;
  }>;
}

export async function TeacherPageContent({ searchParams }: TeacherPageContentProps) {
  const sp = await searchParams;
  const { view: rawView } = sp;
  const ctx = await getIdentityContext();
  const permissions = new Set(ctx?.permissions ?? []);
  const isAdmin = ctx?.isEnterpriseAdmin;

  const visibleTabs = TEACHER_TABS.filter(
    (t) => !t.permission || permissions.has(t.permission) || permissions.has("teacher.manage") || isAdmin
  );

  const validViews = new Set(visibleTabs.map((t) => t.value));
  const view =
    rawView && validViews.has(rawView as (typeof TEACHER_TABS)[number]["value"])
      ? rawView
      : "my-day";

  const supabase = await createAuthClient();
  const employeeId = ctx ? await getTeacherEmployeeId(supabase, ctx.effectiveUserId) : null;

  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0] ||
    ctx?.orgAssignments[0]?.school_id;

  if (!employeeId) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <PageHeader title="Teacher Workspace" subtitle="Daily instructional hub" />
        <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Your user account is not linked to an active employee record. Contact your administrator to enable the Teacher Workspace.
        </p>
      </div>
    );
  }

  const [sessions, workload, legacyCompliance, docDeadlines, lessonPlans, notes, aiConfig, rosterStudents, interventions, outreach, collaborationFeed, qualityMetrics, schoolQuality, evidenceLibrary] =
    await Promise.all([
      getTeacherTodaySessions(supabase, employeeId),
      getTeacherWorkloadSummary(supabase, employeeId),
      getTeacherComplianceItems(supabase, employeeId),
      getTeacherDocumentationDeadlines(supabase, employeeId),
      getTeacherLessonPlans(supabase, employeeId),
      getTeacherNotes(supabase, employeeId),
      schoolId ? getAiReadinessConfig(supabase, schoolId) : Promise.resolve(null),
      getTeacherRosterStudents(supabase, employeeId),
      getTeacherInterventions(supabase, employeeId),
      getTeacherOutreachHistory(supabase, employeeId),
      getCollaborationFeedForTeacher(supabase, employeeId),
      getInstructionalQualityMetrics(supabase, employeeId),
      schoolId && (permissions.has("instruction.quality") || isAdmin)
        ? getSchoolInstructionalQualitySummary(supabase, schoolId)
        : Promise.resolve(null),
      searchEvidenceLibrary(supabase, {
        employeeId,
        query: sp.q,
        artifactType: sp.artifact_type,
        subjectDomain: sp.subject_domain,
        dateFrom: sp.date_from,
        dateTo: sp.date_to,
      }),
    ]);

  const compliance = [
    ...docDeadlines,
    ...legacyCompliance.filter((item) => !docDeadlines.some((d) => d.title === item.title)),
  ];

  const sessionStudentIds = [
    ...new Set(
      sessions.flatMap((s) =>
        s.students
          .map((st: { id?: string }) => st.id)
          .filter((id: string | undefined): id is string => Boolean(id))
      )
    ),
  ];
  const readinessByStudent = await getSessionReadinessForStudents(supabase, sessionStudentIds);

  const progressByDomain: Record<string, { assessment_date: string; current_level: number }[]> = {
    reading: [],
    writing: [],
    math: [],
    structured_literacy: [],
  };

  if (rosterStudents.length) {
    const sampleStudentId = rosterStudents[0].id as string;
    for (const domain of Object.keys(progressByDomain)) {
      const { data } = await supabase
        .from("student_academic_progress_records")
        .select("assessment_date, current_level")
        .eq("student_id", sampleStudentId)
        .eq("domain", domain)
        .order("assessment_date", { ascending: true })
        .limit(12);
      progressByDomain[domain] = data ?? [];
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Teacher Workspace"
        subtitle="Your daily schedule, sessions, progress, and compliance — all in one place"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today's sessions"
          value={formatCount(workload.sessionsToday)}
          description="Scheduled for today"
          accent="indigo"
          icon={<span className="text-lg font-bold">T</span>}
        />
        <StatCard
          title="Weekly hours"
          value={`${workload.weeklyHours}h`}
          description={`${workload.sessionsThisWeek} sessions`}
          accent="sky"
          icon={<span className="text-lg font-bold">H</span>}
        />
        <StatCard
          title="Compliance items"
          value={formatCount(compliance.length)}
          description="Needs attention"
          accent="amber"
          icon={<span className="text-lg font-bold">C</span>}
        />
        <StatCard
          title="Mission Control"
          value={formatCount(workload.missionControlAlerts)}
          description="Open alerts"
          accent="rose"
          icon={<span className="text-lg font-bold">!</span>}
        />
      </div>

      <ViewTabs tabs={visibleTabs.map(({ href, label, value }) => ({ href, label, value }))} activeView={view} />

      <TeacherTabsPanel
        view={view}
        sessions={sessions}
        workload={workload}
        compliance={compliance}
        lessonPlans={lessonPlans}
        notes={notes}
        aiConfig={aiConfig}
        progressByDomain={progressByDomain}
        rosterStudents={rosterStudents as { id: string; first_name?: string; last_name?: string }[]}
        interventions={interventions}
        outreach={outreach}
        collaborationFeed={collaborationFeed}
        qualityMetrics={qualityMetrics}
        schoolQuality={schoolQuality}
        evidenceLibrary={evidenceLibrary}
        readinessByStudent={readinessByStudent}
        evidenceFilterBasePath="/dashboard/teacher"
      />
    </div>
  );
}

export function TeacherPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-slate-100" />
    </div>
  );
}
