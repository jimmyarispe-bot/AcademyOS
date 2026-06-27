import { StatCard } from "@/components/dashboard/StatCard";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { MyWorkPanel } from "@/components/work/WorkPanels";
import { ProjectsList, TasksList } from "@/components/work/WorkLists";
import { formatCount } from "@/lib/format";
import { canViewWork } from "@/lib/work/access";
import { getMyWorkSummary, getUserWorkload, getProjects, getTasks } from "@/lib/work/queries";
import { WORK_TABS } from "@/lib/work/types";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

interface WorkPageContentProps {
  searchParams: Promise<{ view?: string }>;
}

export async function WorkPageContent({ searchParams }: WorkPageContentProps) {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewWork(ctx)) redirect("/dashboard");

  const { view: rawView } = await searchParams;
  const validViews = new Set(WORK_TABS.map((t) => t.value));
  const view = rawView && validViews.has(rawView as (typeof WORK_TABS)[number]["value"]) ? rawView : "my-work";

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    undefined;

  const supabase = await createAuthClient();
  const userId = ctx.effectiveUserId;

  const [summary, workload, projects, tasks] = await Promise.all([
    getMyWorkSummary(supabase, userId, schoolId),
    getUserWorkload(supabase, userId, schoolId),
    getProjects(supabase, { schoolId, limit: 50 }),
    getTasks(supabase, { assigneeUserId: userId, schoolId, limit: 100 }),
  ]);

  const approvalTasks = tasks.filter((t) => t.status === "needs_review" || t.task_type === "approval");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="My Work"
          subtitle="Tasks, approvals, projects, and deadlines — your personalized work hub"
        />
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/dashboard/projects" className="text-brand-600 hover:underline">Projects →</Link>
          <Link href="/dashboard/playbooks" className="text-brand-600 hover:underline">Playbooks →</Link>
          <Link href="/dashboard/workload" className="text-brand-600 hover:underline">Workload →</Link>
          <Link href="/dashboard/work/reports" className="text-brand-600 hover:underline">Reports →</Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today" value={formatCount(summary.tasksToday)} description="Tasks due today" accent="indigo" icon={<span className="font-bold">T</span>} />
        <StatCard title="Overdue" value={formatCount(summary.overdue)} description="Needs attention" accent="rose" icon={<span className="font-bold">!</span>} />
        <StatCard title="Approvals" value={formatCount(summary.waitingApprovals)} description="Waiting on you" accent="amber" icon={<span className="font-bold">A</span>} />
        <StatCard title="Projects" value={formatCount(summary.activeProjects)} description="Active assignments" accent="sky" icon={<span className="font-bold">P</span>} />
      </section>

      <ViewTabs tabs={WORK_TABS.map(({ href, label, value }) => ({ href, label, value }))} activeView={view} />

      {view === "my-work" && <MyWorkPanel summary={summary} workload={workload} />}
      {view === "tasks" && <TasksList tasks={tasks} />}
      {view === "projects" && <ProjectsList projects={projects} />}
      {view === "approvals" && <TasksList tasks={approvalTasks} />}
      {view === "meetings" && (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Meeting tasks linked from playbooks and scheduling appear in your task list when assigned.
        </p>
      )}
    </div>
  );
}

export function WorkPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
