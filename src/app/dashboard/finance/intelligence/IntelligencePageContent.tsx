import { StatCard } from "@/components/dashboard/StatCard";
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
import Link from "next/link";

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
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/dashboard/finance" className="text-brand-600 hover:underline">Finance →</Link>
          <Link href="/dashboard/executive" className="text-brand-600 hover:underline">Executive Intelligence →</Link>
          <Link href="/api/financial-intelligence/reports?type=classes" className="text-brand-600 hover:underline">Export CSV →</Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="EBITDA" value={formatCurrency(executive.ebitda)} description="School-level contribution" accent="emerald" icon={<span className="font-bold">E</span>} />
        <StatCard title="Revenue" value={formatCurrency(school.revenue)} description={`${school.operatingMargin.toFixed(1)}% operating margin`} accent="indigo" icon={<span className="font-bold">R</span>} />
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
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
