import { StatCard } from "@/components/dashboard/StatCard";
import {
  DashboardSkeleton,
  ProgressivePageShell,
} from "@/components/experience-system";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  FiExecutiveOverview,
  ClassProfitabilityTable,
  TeacherProfitabilityTable,
  ProgramProfitabilityTable,
  StudentEconomicsTable,
  FamilyAnalyticsTable,
  ScenarioPanel,
  ImportPanel,
} from "@/components/financial-intelligence/FiPanels";
import { formatCurrency } from "@/lib/format";
import { canViewFi } from "@/lib/financial-intelligence/access";
import { FI_TABS } from "@/lib/financial-intelligence/types";
import { getExecutiveFinancialDashboard } from "@/lib/financial-intelligence/executive";
import {
  computeClassProfitability,
  computeTeacherProfitability,
  computeProgramProfitability,
  computeStudentEconomics,
} from "@/lib/financial-intelligence/profitability";
import { getFamilyAnalytics } from "@/lib/financial-intelligence/family-analytics";
import { computeSchoolFinancials } from "@/lib/financial-intelligence/school-financials";
import { getScenarios } from "@/lib/financial-intelligence/scenarios";
import type { ScenarioResult } from "@/lib/financial-intelligence/types";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { redirect } from "next/navigation";
import { ActionChip, ActionChipGroup } from "@/components/experience-system/feedback/ActionChip";

interface IntelligencePageContentProps {
  searchParams: Promise<{ view?: string }>;
}

export async function IntelligencePageContent({ searchParams }: IntelligencePageContentProps) {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewFi(ctx)) redirect("/dashboard");

  const { view: rawView } = await searchParams;
  const validViews = new Set(FI_TABS.map((t) => t.value));
  const view = rawView && validViews.has(rawView as (typeof FI_TABS)[number]["value"]) ? rawView : "overview";

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    "";

  if (!schoolId) redirect("/dashboard");

  const supabase = await createAuthClient();

  const [
    executive,
    school,
    classes,
    teachers,
    programs,
    students,
    families,
    scenarios,
  ] = await Promise.all([
    getExecutiveFinancialDashboard(supabase, schoolId),
    computeSchoolFinancials(supabase, schoolId),
    computeClassProfitability(supabase, schoolId, "monthly"),
    computeTeacherProfitability(supabase, schoolId),
    computeProgramProfitability(supabase, schoolId),
    computeStudentEconomics(supabase, schoolId),
    getFamilyAnalytics(supabase, schoolId),
    getScenarios(supabase, schoolId),
  ]);

  const latestScenario = scenarios[0];
  const latestResults = latestScenario?.fi_scenario_results as Array<Record<string, unknown>> | undefined;
  const latestResult = latestResults?.[0]
    ? ({
        projectedRevenue: Number(latestResults[0].projected_revenue),
        projectedExpenses: Number(latestResults[0].projected_expenses),
        projectedPayroll: Number(latestResults[0].projected_payroll),
        projectedEbitda: Number(latestResults[0].projected_ebitda),
        projectedCashFlow: Number(latestResults[0].projected_cash_flow),
        projectedMarginPct: Number(latestResults[0].projected_margin_pct),
        deltaRevenue: Number(latestResults[0].delta_revenue),
        deltaEbitda: Number(latestResults[0].delta_ebitda),
      } satisfies ScenarioResult)
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Financial Intelligence"
          subtitle="Enterprise business analytics — profitability, forecasting, scenarios, and executive dashboards"
        />
        <ActionChipGroup>
          <ActionChip href="/dashboard/finance" size="sm">Finance</ActionChip>
          <ActionChip href="/dashboard/executive" size="sm">Executive Intelligence</ActionChip>
          <ActionChip href="/api/financial-intelligence/reports?type=classes" size="sm">Export CSV</ActionChip>
        </ActionChipGroup>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="EBITDA" value={formatCurrency(executive.ebitda)} description="School-level contribution" accent="emerald" icon={<span className="font-bold">E</span>} />
        {/* The margin is shown only when it came off a real QuickBooks report.
            Until 9 Sep 2026 this read "27.0% operating margin" for every school
            on every run, because payroll and expenses were two constants applied
            to revenue. A named gap is worth more than a number nobody can trace. */}
        <StatCard
          title="Revenue"
          value={formatCurrency(school.revenue)}
          description={
            school.basis === "quickbooks"
              ? `${school.operatingMargin.toFixed(1)}% operating margin · ${school.periodStart} to ${school.periodEnd}`
              : (school.basisNote ?? "No margin — the books are not connected")
          }
          accent="indigo"
          icon={<span className="font-bold">R</span>}
        />
        <StatCard title="Below break-even" value={String(executive.classesBelowBreakeven)} description="Classes needing enrollment" accent="amber" icon={<span className="font-bold">!</span>} />
        <StatCard title="Financial risks" value={String(executive.financialRisks)} description="Active FI alerts" accent="rose" icon={<span className="font-bold">⚠</span>} />
      </section>

      <ViewTabs tabs={FI_TABS.map(({ href, label, value }) => ({ href, label, value }))} activeView={view} />

      {view === "overview" && <FiExecutiveOverview dashboard={executive} />}
      {view === "classes" && <ClassProfitabilityTable rows={classes} />}
      {view === "teachers" && <TeacherProfitabilityTable rows={teachers} />}
      {view === "programs" && <ProgramProfitabilityTable rows={programs} />}
      {view === "students" && <StudentEconomicsTable rows={students} />}
      {view === "families" && <FamilyAnalyticsTable rows={families} />}
      {view === "scenarios" && (
        <ScenarioPanel scenarios={scenarios} latestResult={latestResult} schoolId={schoolId} />
      )}
      {view === "import" && <ImportPanel schoolId={schoolId} />}
    </div>
  );
}

export function IntelligencePageSkeleton() {
  return (
    <ProgressivePageShell
      title="Financial Intelligence"
      subtitle="Profitability, scenarios, and forecasting"
      breadcrumbs={[{ label: "Finance", href: "/dashboard/finance" }, { label: "Intelligence" }]}
      label="Loading financial intelligence…"
      showDefaultBody={false}
    >
      <DashboardSkeleton />
    </ProgressivePageShell>
  );
}
