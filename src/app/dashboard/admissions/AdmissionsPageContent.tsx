import Link from "next/link";
import { Suspense } from "react";
import { AdmissionsReporting } from "@/components/admissions/AdmissionsReporting";
import { ExecutiveAdmissionsDashboard } from "@/components/admissions/ExecutiveAdmissionsDashboard";
import { KanbanBoard } from "@/components/admissions/KanbanBoard";
import { LeadList } from "@/components/admissions/LeadList";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getExecutiveAdmissionsMetrics,
  getLeadsDrillDown,
} from "@/lib/admissions/executive-metrics";
import { getAdmissionsReporting, getLeads } from "@/lib/admissions/queries";

export const ADMISSIONS_TABS = [
  { href: "/dashboard/admissions?view=executive", label: "Executive", value: "executive" },
  { href: "/dashboard/admissions?view=kanban", label: "Kanban Board", value: "kanban" },
  { href: "/dashboard/admissions?view=list", label: "Lead List", value: "list" },
  { href: "/dashboard/admissions?view=reporting", label: "Reporting", value: "reporting" },
] as const;

const SUB_NAV = [
  { href: "/dashboard/admissions/automation", label: "Automation" },
  { href: "/dashboard/admissions/workflows", label: "Workflows" },
  { href: "/dashboard/admissions/communications", label: "Templates" },
  { href: "/dashboard/admissions/state-funding", label: "State Funding" },
  { href: "/dashboard/admissions/funding-programs", label: "Funding Programs" },
  { href: "/dashboard/admissions/reconciliation", label: "Reconciliation" },
  { href: "/dashboard/admissions/checklist", label: "Checklist Settings" },
  { href: "/dashboard/ceo", label: "CEO Dashboard" },
];

interface AdmissionsPageContentProps {
  searchParams: Promise<{ view?: string; drill?: string }>;
}

export async function AdmissionsPageContent({ searchParams }: AdmissionsPageContentProps) {
  const { view: rawView, drill = "active" } = await searchParams;
  const validViews = new Set(ADMISSIONS_TABS.map((tab) => tab.value));
  const view = rawView && validViews.has(rawView as (typeof ADMISSIONS_TABS)[number]["value"])
    ? rawView
    : "executive";

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
        subtitle="Manage inquiries, tours, applications, and state funding"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/apply"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Parent Inquiry Form
            </Link>
            <Link
              href="/dashboard/admissions/leads/new"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Add Lead
            </Link>
          </div>
        }
      />

      <nav className="flex flex-wrap gap-2">
        {SUB_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <ViewTabs tabs={[...ADMISSIONS_TABS]} activeView={view} />

      {view === "executive" && execMetrics ? (
        <ExecutiveAdmissionsDashboard
          metrics={execMetrics}
          drillDown={drillDown}
          drillFilter={drill}
        />
      ) : view === "reporting" ? (
        <AdmissionsReporting report={report} />
      ) : view === "list" ? (
        <LeadList leads={leads} />
      ) : (
        <KanbanBoard leads={leads} />
      )}
    </div>
  );
}

export function AdmissionsPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-slate-200" />
      <div className="h-11 rounded-xl bg-slate-100" />
      <div className="h-96 rounded-2xl bg-slate-100" />
    </div>
  );
}
