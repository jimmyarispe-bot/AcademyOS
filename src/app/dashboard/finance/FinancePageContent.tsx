import Link from "next/link";
import {
  ExecutionPipeline,
  FinanceExperienceShell,
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
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { StatCard } from "@/components/dashboard/StatCard";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { IntelligenceLink } from "@/components/ui/IntelligenceLink";
import { formatCount, formatCurrency } from "@/lib/format";
import {
  getBillingAccounts,
  getFamiliesForBilling,
  getFinanceStats,
  getInvoices,
  getPayments,
  getSchools,
  getStudentsForBilling,
  getTuitionPlans,
} from "@/lib/finance/queries";
import { getLatestForecast } from "@/lib/finance/forecasting";
import { FinanceOperationsDashboard } from "@/components/finance/FinanceOperationsDashboard";
import {
  canEditFinance,
  getFinanceOperationsSummary,
  listFamilyFinancialAccounts,
  listRefundQueue,
} from "@/lib/finance-platform";
import { executeWorkspace } from "@/lib/platform/execution-engine";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { FINANCE_WORK_PERSPECTIVES, resolveJagWorkPerspective, resolveJagWorkQueue } from "@/lib/platform/jag-work";
import { createAuthClient } from "@/lib/supabase/server-auth";
import "@/lib/platform/execution-engine";
import "@/lib/finance-platform/payments";
import "@/lib/finance-platform/accounting";

export const FINANCE_TABS = [
  { href: "/dashboard/finance?view=invoices", label: "Invoices", value: "invoices" },
  { href: "/dashboard/finance?view=payments", label: "Payments", value: "payments" },
  { href: "/dashboard/finance/tuition", label: "Tuition", value: "tuition" },
  { href: "/dashboard/finance/schedules", label: "Payment Schedules", value: "schedules" },
  { href: "/dashboard/finance?view=plans", label: "Tuition Plans", value: "plans" },
  { href: "/dashboard/finance?view=accounts", label: "Billing Accounts", value: "accounts" },
  { href: "/dashboard/finance?view=families", label: "Families", value: "families" },
  { href: "/dashboard/finance?view=forecast", label: "Forecast", value: "forecast" },
  { href: "/dashboard/finance/intelligence", label: "Intelligence", value: "intelligence" },
  { href: "/dashboard/finance/executive", label: "Executive", value: "executive" },
  { href: "/dashboard/admissions/state-funding", label: "State Funding", value: "state-funding" },
  { href: "/dashboard/scholarships", label: "Scholarships", value: "scholarships" },
  { href: "/dashboard/finance?view=create", label: "Create", value: "create" },
  { href: "/dashboard/finance?view=operations", label: "Operations", value: "operations" },
] as const;

interface FinancePageContentProps {
  searchParams: Promise<{ view?: string; work?: string }>;
}

async function FinanceLegacyView({ view }: { view: string }) {
  const ctx = await getIdentityContext();
  const schoolId = ctx?.orgAssignments.find((a) => a.is_primary)?.school_id || ctx?.accessibleSchoolIds[0];
  const supabase = await createAuthClient();

  const [stats, invoices, payments, plans, accounts, families, students, schools, forecast, opsSummary, familyAccounts, refundQueue] =
    await Promise.all([
      getFinanceStats(),
      getInvoices(),
      getPayments(),
      getTuitionPlans(),
      getBillingAccounts(),
      getFamiliesForBilling(),
      getStudentsForBilling(),
      getSchools(),
      schoolId ? getLatestForecast(supabase, schoolId) : Promise.resolve(null),
      getFinanceOperationsSummary(supabase, { schoolId }),
      listFamilyFinancialAccounts(supabase, { schoolId }),
      listRefundQueue(supabase, { schoolId, status: "open" }),
    ]);

  const overdueCount = invoices.filter(
    (inv) => !["paid", "void", "cancelled"].includes(inv.invoice_status) && inv.due_date < new Date().toISOString().split("T")[0]!
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Finance & Billing"
        subtitle="Tuition, invoices, payments, scholarships, plans, aging, and revenue operations"
        actions={
          <Link href="/dashboard/finance?work=today" className="rounded-xl border border-brand-200 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
            ← Work queue
          </Link>
        }
      />
      {/* Finance & Billing reports on invoices JAG has issued, and JAG has issued
          none - Square does the billing - so every tile below reads $0. That is
          accurate and it is also the single most misleading screen in the
          product, because it is where a founder looks first for money. The real
          books are one click away and were previously unreachable from here. */}
      <IntelligenceLink
        title="Looking for revenue, EBITDA or cash?"
        description="Financial Intelligence reads the QuickBooks books — real income, margin and bank balance for each campus, and a consolidated view of the whole network."
        href="/dashboard/finance/intelligence"
        linkLabel="Open Financial Intelligence"
        caveat="The tiles on this page count invoices raised inside JAG. Square does your billing, so they read $0 — that is the tool telling the truth about itself, not a network with no income."
      />

      {(view === "operations" || view === "accounts") && (
        <FinanceOperationsDashboard
          summary={opsSummary}
          accounts={familyAccounts}
          refundQueue={refundQueue.map((r) => ({
            id: r.id as string,
            amount: Number(r.amount),
            status: String(r.status),
            reason: String(r.reason ?? ""),
            requested_at: String(r.requested_at),
          }))}
          canEdit={canEditFinance(ctx)}
        />
      )}
      {view !== "operations" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Billed" value={formatCurrency(stats.totalBilled)} description="All invoices" accent="indigo" icon={<span className="text-lg font-bold">B</span>} />
            <StatCard title="Collected" value={formatCurrency(stats.totalPaid)} description="Payments received" accent="emerald" icon={<span className="text-lg font-bold">C</span>} />
            <StatCard title="Outstanding" value={formatCurrency(stats.outstanding)} description="Unpaid balances" accent="amber" icon={<span className="text-lg font-bold">O</span>} />
            <StatCard title="Invoices" value={formatCount(stats.invoiceCount)} description="Total invoices" accent="sky" icon={<span className="text-lg font-bold">I</span>} />
          </div>
          <ViewTabs tabs={[...FINANCE_TABS]} activeView={view} />
          <FinanceTabs view={view} invoices={invoices} payments={payments} plans={plans} accounts={accounts} families={families} students={students} schools={schools} forecast={forecast} overdueCount={overdueCount} />
        </>
      ) : (
        <ViewTabs tabs={[...FINANCE_TABS]} activeView={view} />
      )}
    </div>
  );
}

export async function FinancePageContent({ searchParams }: FinancePageContentProps) {
  const sp = await searchParams;
  const legacyViews = new Set(FINANCE_TABS.map((t) => t.value));
  if (sp.view && legacyViews.has(sp.view as (typeof FINANCE_TABS)[number]["value"])) {
    return <FinanceLegacyView view={sp.view} />;
  }

  // Default landing: operations overview (RC7)
  if (!sp.view && !sp.work) {
    return <FinanceLegacyView view="operations" />;
  }

  const ctx = await getIdentityContext();
  if (!ctx) return null;

  const workPerspective = resolveJagWorkPerspective("finance", sp.work);
  // P004: overlap engine with independent finance domain loads.
  const [execution, supabase, [stats, invoices, billingAccounts]] = await Promise.all([
    executeWorkspace({
      workspaceKey: "finance",
      identity: ctx,
      activeView: workPerspective,
      recommendationFacts: { has_permission: ctx.permissions.length > 0 },
    }),
    createAuthClient(),
    Promise.all([getFinanceStats(), getInvoices(), getBillingAccounts()]),
  ]);
  const workspaceState = execution.state;

  const workQueue = await resolveJagWorkQueue({
    workspaceKey: "finance",
    input: {
      supabase,
      identity: ctx,
      activePerspective: workPerspective,
      invoices,
      billingAccounts,
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
  const perspectiveLabel = FINANCE_WORK_PERSPECTIVES.find((p) => p.id === workPerspective)?.label ?? "Today's Work";
  const activeItems = workQueue.perspectives[workPerspective] ?? [];

  return (
    <FinanceExperienceShell
      breadcrumbs={[{ label: "Finance", href: "/dashboard/finance?work=today" }, { label: perspectiveLabel }]}
      navItems={navItems}
      fullName={ctx.fullName}
      roleLabel={ctx.roleLabel}
      subtitle={orgContext?.activeScope.schoolName ?? "Billing & revenue operations"}
      insightPanel={
        <div className="space-y-4">
          {orgContext && <JagOrganizationContextPanel org={orgContext} />}
          <ExecutionPipeline title="Work resolution" currentStepId="execute" compact />
          <QuickActions
            title="Finance shortcuts"
            actions={[
              { id: "invoices", label: "Invoices", href: "/dashboard/finance?view=invoices", variant: "secondary" },
              { id: "collections", label: "Collections due", href: "/dashboard/finance?work=collections_due", variant: "primary" },
              { id: "intel", label: "Financial intelligence", href: "/dashboard/finance/intelligence", variant: "secondary" },
            ]}
          />
        </div>
      }
    >
      {orgContext && <JagOrganizationContextBar org={orgContext} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Work in queue" value={formatCount(activeItems.length)} description={perspectiveLabel} accent="brand" icon={<span className="text-lg font-bold">W</span>} />
        <MetricCard title="Outstanding" value={formatCurrency(stats.outstanding)} description="Accounts receivable" accent="amber" icon={<span className="text-lg font-bold">$</span>} />
        <MetricCard title="Collections due" value={formatCount(workQueue.counts.collections_due ?? 0)} description="Overdue items" accent="amber" icon={<span className="text-lg font-bold">!</span>} />
        <MetricCard title="Ready to post" value={formatCount(workQueue.counts.ready_to_post ?? 0)} description="Draft invoices" accent="emerald" icon={<span className="text-lg font-bold">P</span>} />
      </div>
      <JagWorkPanel queue={workQueue} perspective={workPerspective} />
    </FinanceExperienceShell>
  );
}

export function FinancePageSkeleton() {
  return (
    <ProgressivePageShell {...progressiveShellProps("finance")} showDefaultBody={false}>
      <KpiTilesSkeleton count={4} />
      <ListSkeleton rows={8} />
    </ProgressivePageShell>
  );
}
