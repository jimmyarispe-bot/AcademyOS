import Link from "next/link";
import {
  AdmissionsExperienceShell,
  AiRecommendationCard,
  ExecutionPipeline,
  JagOrganizationContextBar,
  JagOrganizationContextPanel,
  JagWorkPanel,
  KpiTilesSkeleton,
  ListSkeleton,
  MetricCard,
  ProgressivePageShell,
  QuickActions,
  progressiveShellProps,
  type XesNavItem,
} from "@/components/experience-system";
import { AdmissionsReporting } from "@/components/admissions/AdmissionsReporting";
import { AdmissionsPipelineBoard } from "@/components/admissions/AdmissionsPipelineBoard";
import { ExecutiveAdmissionsDashboard } from "@/components/admissions/ExecutiveAdmissionsDashboard";
import { KanbanBoard } from "@/components/admissions/KanbanBoard";
import { LeadList } from "@/components/admissions/LeadList";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCount } from "@/lib/format";
import {
  getExecutiveAdmissionsMetrics,
  getLeadsDrillDown,
} from "@/lib/admissions/executive-metrics";
import { getAdmissionsReporting, getAdmissionsWorkData, getLeads } from "@/lib/admissions/queries";
import { executeWorkspace } from "@/lib/platform/execution-engine";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { ADMISSIONS_WORK_PERSPECTIVES, resolveJagWorkPerspective, resolveJagWorkQueue } from "@/lib/platform/jag-work";
import { createAuthClient } from "@/lib/supabase/server-auth";
import "@/lib/platform/execution-engine";

export const ADMISSIONS_TABS = [
  { href: "/dashboard/admissions?view=executive", label: "Executive", value: "executive" },
  { href: "/dashboard/admissions?view=pipeline", label: "Pipeline Board", value: "pipeline" },
  { href: "/dashboard/admissions?view=kanban", label: "Legacy Kanban", value: "kanban" },
  { href: "/dashboard/admissions?view=list", label: "Lead List", value: "list" },
  { href: "/dashboard/admissions?view=reporting", label: "Reporting", value: "reporting" },
] as const;

const SUB_NAV = [
  { href: "/dashboard/admissions/waiting", label: "Waiting on us" },
  { href: "/dashboard/admissions/automation", label: "Automation" },
  { href: "/dashboard/admissions/workflows", label: "Workflows" },
  { href: "/dashboard/admissions/communications", label: "Templates" },
  { href: "/dashboard/admissions/state-funding", label: "State Funding" },
  { href: "/dashboard/admissions/funding-programs", label: "Funding Programs" },
  { href: "/dashboard/admissions/reconciliation", label: "Reconciliation" },
  { href: "/dashboard/admissions/checklist", label: "Checklist Settings" },
  { href: "/apply", label: "Parent Inquiry Form" },
  { href: "/dashboard/admissions/leads/new", label: "Add Lead" },
  { href: "/dashboard/admissions/import", label: "Bulk Import" },
];

interface AdmissionsPageContentProps {
  searchParams: Promise<{ view?: string; work?: string; drill?: string }>;
}

async function AdmissionsLegacyView({
  view,
  drill,
}: {
  view: string;
  drill: string;
}) {
  const [leads, report, execMetrics, drillDown] = await Promise.all([
    getLeads(),
    getAdmissionsReporting(),
    view === "executive" ? getExecutiveAdmissionsMetrics() : Promise.resolve(null),
    view === "executive" ? getLeadsDrillDown(drill) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Admissions CRM"
        subtitle="Pipeline, applications, and enrollment tools"
        actions={
          <Link href="/dashboard/admissions?work=today" className="rounded-xl border border-brand-200 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
            ← Work queue
          </Link>
        }
      />
      <nav className="flex flex-wrap gap-2">
        {SUB_NAV.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            {item.label}
          </Link>
        ))}
      </nav>
      <ViewTabs tabs={[...ADMISSIONS_TABS]} activeView={view} />
      {view === "executive" && execMetrics ? (
        <ExecutiveAdmissionsDashboard metrics={execMetrics} drillDown={drillDown} drillFilter={drill} />
      ) : view === "reporting" ? (
        <AdmissionsReporting report={report} />
      ) : view === "list" ? (
        <LeadList leads={leads} />
      ) : view === "pipeline" ? (
        <AdmissionsPipelineBoard leads={leads} />
      ) : (
        <KanbanBoard leads={leads} />
      )}
    </div>
  );
}

export async function AdmissionsPageContent({ searchParams }: AdmissionsPageContentProps) {
  const sp = await searchParams;
  const legacyViews = new Set(ADMISSIONS_TABS.map((t) => t.value));

  if (sp.view && legacyViews.has(sp.view as (typeof ADMISSIONS_TABS)[number]["value"])) {
    return <AdmissionsLegacyView view={sp.view} drill={sp.drill ?? "active"} />;
  }

  const ctx = await getIdentityContext();
  if (!ctx) return null;

  const workPerspective = resolveJagWorkPerspective("admissions", sp.work);
  // P004: overlap engine with independent admissions domain loads.
  const [execution, supabase, [leads, workData]] = await Promise.all([
    executeWorkspace({
      workspaceKey: "admissions",
      identity: ctx,
      activeView: workPerspective,
      recommendationFacts: { has_permission: ctx.permissions.length > 0 },
    }),
    createAuthClient(),
    Promise.all([getLeads(), getAdmissionsWorkData()]),
  ]);
  const workspaceState = execution.state;

  const workQueue = await resolveJagWorkQueue({
    workspaceKey: "admissions",
    input: {
      supabase,
      identity: ctx,
      activePerspective: workPerspective,
      leads,
      tasks: workData.tasks,
      tours: workData.tours,
      engineRecommendations: workspaceState?.recommendations ?? [],
      executionState: workspaceState,
    },
  });

  const navItems: XesNavItem[] = (workspaceState?.navigation ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    active: item.id === workPerspective,
    badge: workQueue.counts[item.id] || undefined,
  }));

  const orgContext = workspaceState?.org ?? null;
  const perspectiveLabel =
    ADMISSIONS_WORK_PERSPECTIVES.find((p) => p.id === workPerspective)?.label ?? "Today's Work";
  const activeItems = workQueue.perspectives[workPerspective] ?? [];

  const insightPanel = (
    <div className="space-y-4">
      {orgContext && <JagOrganizationContextPanel org={orgContext} />}
      <ExecutionPipeline title="Work resolution" currentStepId="execute" compact />
      {(workspaceState?.recommendations ?? []).slice(0, 2).map((rec) => (
        <AiRecommendationCard
          key={rec.id}
          recommendation={{
            ...rec,
            confidence: rec.priority === "high" ? 88 : 72,
            knowledge: (workspaceState?.knowledge ?? []).slice(0, 2).map((k) => ({
              id: k.nodeKey,
              title: k.title,
              layerKind: k.kind,
            })),
          }}
        />
      ))}
      <QuickActions
        title="Admissions shortcuts"
        actions={[
          { id: "pipeline", label: "Pipeline board", href: "/dashboard/admissions?view=pipeline", variant: "secondary" },
          { id: "add-lead", label: "Add lead", href: "/dashboard/admissions/leads/new", variant: "primary" },
          { id: "enrollment", label: "Ready for enrollment", href: "/dashboard/admissions?work=ready_for_enrollment", variant: "secondary" },
          { id: "bulk-import", label: "Bulk import leads", href: "/dashboard/admissions/import", variant: "secondary" },
          { id: "people", label: "All people", href: "/dashboard/people", variant: "secondary" },
        ]}
      />
    </div>
  );

  return (
    <AdmissionsExperienceShell
      breadcrumbs={[
        { label: "Admissions & Enrollment", href: "/dashboard/admissions?work=today" },
        { label: perspectiveLabel },
      ]}
      navItems={navItems}
      fullName={ctx.fullName}
      roleLabel={ctx.roleLabel}
      insightPanel={insightPanel}
      subtitle={orgContext?.activeScope.schoolName ?? "Enrollment funnel"}
      headerActions={
        <>
          <Link
            href="/dashboard/admissions/import"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Bulk Import
          </Link>
          <Link href="/dashboard/admissions/leads/new" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Add Lead
          </Link>
        </>
      }
    >
      {orgContext && <JagOrganizationContextBar org={orgContext} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Work in queue" value={formatCount(activeItems.length)} description={perspectiveLabel} accent="brand" icon={<span className="text-lg font-bold">W</span>} />
        <MetricCard title="Active pipeline" value={formatCount(leads.filter((l) => !["enrolled", "declined"].includes(l.lead_stage)).length)} description="Open cases" accent="indigo" icon={<span className="text-lg font-bold">P</span>} />
        <MetricCard title="Documents pending" value={formatCount(workQueue.counts.documents_pending ?? 0)} description="Cases needing records" accent="amber" icon={<span className="text-lg font-bold">D</span>} />
        <MetricCard title="Ready to enroll" value={formatCount(workQueue.counts.ready_for_enrollment ?? 0)} description="Accepted families" accent="emerald" icon={<span className="text-lg font-bold">E</span>} />
      </div>
      <JagWorkPanel queue={workQueue} perspective={workPerspective} />
    </AdmissionsExperienceShell>
  );
}

export function AdmissionsPageSkeleton() {
  return (
    <ProgressivePageShell {...progressiveShellProps("admissions")} showDefaultBody={false}>
      <KpiTilesSkeleton count={4} />
      <ListSkeleton rows={8} />
    </ProgressivePageShell>
  );
}
