import { cache } from "react";
import Link from "next/link";
import {
  ExecutionPipeline,
  JagOrganizationContextBar,
  JagOrganizationContextPanel,
  JagWorkPanel,
  KpiTilesSkeleton,
  ListSkeleton,
  MetricCard,
  ProgressivePageShell,
  QuickActions,
  StudentsExperienceShell,
  WidgetBoundary,
  progressiveShellProps,
  type XesNavItem,
} from "@/components/experience-system";
import { StatCard } from "@/components/dashboard/StatCard";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { IntelligenceLink } from "@/components/ui/IntelligenceLink";
import { FundingBreakdown } from "@/components/ui/FundingBreakdown";
import { StudentList } from "@/components/students/StudentList";
import { FamilyList } from "@/components/students/FamilyList";
import { StudentForm } from "@/components/students/StudentForm";
import { formatCount } from "@/lib/format";
import { executeWorkspace } from "@/lib/platform/execution-engine";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { STUDENTS_WORK_PERSPECTIVES, resolveJagWorkPerspective, resolveJagWorkQueue } from "@/lib/platform/jag-work";
import { canManageStudentLifecycle } from "@/lib/students/lifecycle";
import {
  getFamilies,
  getSchools,
  getSchoolYears,
  getStudents,
  getStudentStats,
  type StudentListStatusFilter,
} from "@/lib/students/queries";
import { createAuthClient } from "@/lib/supabase/server-auth";
import "@/lib/platform/execution-engine";

export const STUDENT_TABS = [
  { href: "/dashboard/students?view=students", label: "Students", value: "students" },
  { href: "/dashboard/families", label: "Families", value: "families" },
  { href: "/dashboard/students?view=add", label: "Add Student", value: "add" },
  { href: "/dashboard/students/import", label: "Bulk Import", value: "import" },
] as const;

function parseStatusFilter(raw?: string): StudentListStatusFilter {
  if (raw === "archived" || raw === "all") return raw;
  return "active";
}

interface StudentsPageContentProps {
  searchParams: Promise<{ view?: string; work?: string; status?: string }>;
}

const loadStudentsWorkBundle = cache(async (work: string | undefined) => {
  const ctx = await getIdentityContext();
  if (!ctx) return null;

  const workPerspective = resolveJagWorkPerspective("students", work);
  // P004: overlap engine with independent domain loads (no data dependency).
  const [execution, supabase, [students, stats]] = await Promise.all([
    executeWorkspace({
      workspaceKey: "students",
      identity: ctx,
      activeView: workPerspective,
      recommendationFacts: { has_permission: ctx.permissions.length > 0 },
    }),
    createAuthClient(),
    Promise.all([getStudents(), getStudentStats()]),
  ]);
  const workspaceState = execution.state;

  const workQueue = await resolveJagWorkQueue({
    workspaceKey: "students",
    input: {
      supabase,
      identity: ctx,
      activePerspective: workPerspective,
      students,
      engineRecommendations: workspaceState?.recommendations ?? [],
      executionState: workspaceState,
    },
  });

  return {
    ctx,
    workPerspective,
    workspaceState,
    stats,
    workQueue,
    orgContext: workspaceState?.org ?? null,
    perspectiveLabel:
      STUDENTS_WORK_PERSPECTIVES.find((p) => p.id === workPerspective)?.label ?? "Today's Work",
  };
});

async function StudentsLegacyView({
  view,
  statusFilter,
}: {
  view: string;
  statusFilter: StudentListStatusFilter;
}) {
  const [students, families, stats, schools, schoolYears, identity] = await Promise.all([
    getStudents(statusFilter),
    getFamilies(),
    getStudentStats(),
    getSchools(),
    getSchoolYears(),
    getIdentityContext(),
  ]);
  const canManageFamily = Boolean(
    identity?.permissions.includes("families.manage") ||
      identity?.permissions.includes("students.edit")
  );
  const canManageLifecycle = canManageStudentLifecycle(identity);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Student Success (SSIS)"
        subtitle="Unified profiles from acceptance through graduation"
        actions={
          <Link href="/dashboard/students?work=today" className="rounded-xl border border-brand-200 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
            ← Work queue
          </Link>
        }
      />
      <IntelligenceLink
        title="What does each student earn and cost?"
        description="Student Economics reads the QuickBooks books and the tuition ledger — tuition, scholarships, ESA funding and net contribution for every child, per campus."
        href="/dashboard/finance/intelligence?view=students"
        linkLabel="Open Student Economics"
      />
      <WidgetBoundary
        label="Student KPIs"
        errorTitle="Unable to load student metrics"
        skeleton={<KpiTilesSkeleton count={4} />}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Students" value={formatCount(stats.total)} description="All records" accent="indigo" icon={<span className="text-lg font-bold">S</span>} />
          <StatCard title="Enrolled" value={formatCount(stats.enrolled)} description="Enrolled" accent="emerald" icon={<span className="text-lg font-bold">E</span>} />
          <StatCard title="Pending" value={formatCount(stats.pending)} description="Pending enrollment" accent="amber" icon={<span className="text-lg font-bold">P</span>} />
          <StatCard title="Families" value={formatCount(families.length)} description="Registered families" accent="sky" icon={<span className="text-lg font-bold">F</span>} />
        </div>
      </WidgetBoundary>
      <ViewTabs tabs={[...STUDENT_TABS]} activeView={view} />
      <WidgetBoundary
        label="Student records"
        errorTitle="Unable to load student records"
        skeleton={<ListSkeleton rows={8} />}
      >
        {view === "students" && <FundingBreakdown title="Funding Report" byFunding={stats.byFunding} byCategory={stats.byCategory} />}
        {view === "families" ? (
          <FamilyList families={families} />
        ) : view === "add" ? (
          <StudentForm
            schools={schools}
            families={families}
            schoolYears={schoolYears}
            canManageFamily={canManageFamily}
          />
        ) : (
          <StudentList
            students={students}
            statusFilter={statusFilter}
            canManageLifecycle={canManageLifecycle}
          />
        )}
      </WidgetBoundary>
    </div>
  );
}

async function StudentsOrgBar({ work }: { work?: string }) {
  const bundle = await loadStudentsWorkBundle(work);
  if (!bundle?.orgContext) return null;
  return <JagOrganizationContextBar org={bundle.orgContext} />;
}

async function StudentsKpiRow({ work }: { work?: string }) {
  const bundle = await loadStudentsWorkBundle(work);
  if (!bundle) throw new Error("Student metrics are unavailable.");
  const { workQueue, workPerspective, perspectiveLabel, stats } = bundle;
  const activeItems = workQueue.perspectives[workPerspective] ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Work in queue" value={formatCount(activeItems.length)} description={perspectiveLabel} accent="brand" icon={<span className="text-lg font-bold">W</span>} />
      <MetricCard title="Total students" value={formatCount(stats.total)} description="All records" accent="indigo" icon={<span className="text-lg font-bold">S</span>} />
      <MetricCard title="Enrollment pending" value={formatCount(workQueue.counts.enrollment_pending ?? 0)} description="Awaiting completion" accent="amber" icon={<span className="text-lg font-bold">P</span>} />
      <MetricCard title="Records incomplete" value={formatCount(workQueue.counts.records_incomplete ?? 0)} description="Profiles to fix" accent="sky" icon={<span className="text-lg font-bold">R</span>} />
    </div>
  );
}

async function StudentsWorkPanel({ work }: { work?: string }) {
  const bundle = await loadStudentsWorkBundle(work);
  if (!bundle) throw new Error("Student work queue is unavailable.");
  return <JagWorkPanel queue={bundle.workQueue} perspective={bundle.workPerspective} />;
}

async function StudentsInsightPanel({ work }: { work?: string }) {
  const bundle = await loadStudentsWorkBundle(work);
  if (!bundle) throw new Error("Student insights are unavailable.");
  const { orgContext } = bundle;

  return (
    <div className="space-y-4">
      {orgContext && <JagOrganizationContextPanel org={orgContext} />}
      <ExecutionPipeline title="Work resolution" currentStepId="execute" compact />
      <QuickActions
        title="Student shortcuts"
        actions={[
          { id: "list", label: "Student list", href: "/dashboard/students?view=students", variant: "secondary" },
          { id: "add", label: "Add student", href: "/dashboard/students?view=add", variant: "primary" },
          { id: "import", label: "Bulk import", href: "/dashboard/students/import", variant: "secondary" },
          { id: "pending", label: "Enrollment pending", href: "/dashboard/students?work=enrollment_pending", variant: "secondary" },
        ]}
      />
    </div>
  );
}

function staticStudentsNav(activeId: string): XesNavItem[] {
  return STUDENTS_WORK_PERSPECTIVES.map((p) => ({
    id: p.id,
    label: p.label,
    href: `/dashboard/students?work=${p.id}`,
    active: p.id === activeId,
  }));
}

export async function StudentsPageContent({ searchParams }: StudentsPageContentProps) {
  const sp = await searchParams;
  const legacyViews = new Set(STUDENT_TABS.map((t) => t.value));
  if (sp.view && legacyViews.has(sp.view as (typeof STUDENT_TABS)[number]["value"])) {
    return <StudentsLegacyView view={sp.view} statusFilter={parseStatusFilter(sp.status)} />;
  }

  const workPerspective = resolveJagWorkPerspective("students", sp.work);
  const perspectiveLabel =
    STUDENTS_WORK_PERSPECTIVES.find((p) => p.id === workPerspective)?.label ?? "Today's Work";

  return (
    <StudentsExperienceShell
      breadcrumbs={[{ label: "Student Information", href: "/dashboard/students?work=today" }, { label: perspectiveLabel }]}
      navItems={staticStudentsNav(workPerspective)}
      subtitle="Student Success (SSIS)"
      insightPanel={
        <WidgetBoundary
          label="Student insights"
          errorTitle="Unable to load insights"
          skeleton={<ListSkeleton rows={4} />}
        >
          <StudentsInsightPanel work={sp.work} />
        </WidgetBoundary>
      }
    >
      <WidgetBoundary label="Organization context" skeleton={null}>
        <StudentsOrgBar work={sp.work} />
      </WidgetBoundary>

      <WidgetBoundary
        label="Student KPIs"
        errorTitle="Unable to load student metrics"
        skeleton={<KpiTilesSkeleton count={4} />}
      >
        <StudentsKpiRow work={sp.work} />
      </WidgetBoundary>

      <WidgetBoundary
        label="Student work queue"
        errorTitle="Unable to load work queue"
        skeleton={<ListSkeleton rows={8} />}
      >
        <StudentsWorkPanel work={sp.work} />
      </WidgetBoundary>
    </StudentsExperienceShell>
  );
}

export function StudentsPageSkeleton() {
  return (
    <ProgressivePageShell {...progressiveShellProps("students")} showDefaultBody={false}>
      <KpiTilesSkeleton count={4} />
      <ListSkeleton rows={8} />
    </ProgressivePageShell>
  );
}
