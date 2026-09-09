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
import { canAccessSchool, resolvePrimarySchoolId } from "@/lib/platform/identity/school-access";
import { createAuthClient } from "@/lib/supabase/server-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionChip, ActionChipGroup } from "@/components/experience-system/feedback/ActionChip";
import { NetworkOverview } from "@/components/financial-intelligence/NetworkOverview";
import { getNetworkQuickBooksFigures } from "@/lib/financial-intelligence/quickbooks-financials";

interface IntelligencePageContentProps {
  searchParams: Promise<{ view?: string; school?: string }>;
}

export async function IntelligencePageContent({ searchParams }: IntelligencePageContentProps) {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewFi(ctx)) redirect("/dashboard");

  const { view: rawView, school: requestedSchool } = await searchParams;
  const validViews = new Set(FI_TABS.map((t) => t.value));
  const view = rawView && validViews.has(rawView as (typeof FI_TABS)[number]["value"]) ? rawView : "overview";

  /**
   * WHICH SCHOOL AM I LOOKING AT? Until 9 September 2026 this page could not
   * answer that. It resolved:
   *
   *     ctx.orgAssignments.find(a => a.is_primary)?.school_id ||
   *     ctx.accessibleSchoolIds[0] || ""
   *
   * — the user's primary assignment, or failing that whichever id happened to
   * be first in an array with no guaranteed ordering — then rendered a page of
   * money with no campus named anywhere on it and no way to switch. A founder
   * with four schools got one of them, silently, and could not tell which.
   *
   * `resolvePrimarySchoolId` already does this properly and checks access on
   * every candidate; the page had reimplemented it, worse. Now the school comes
   * from the URL when one is asked for, so a campus view is a link somebody can
   * bookmark or send on, and the name is on the page either way.
   */
  const supabase = await createAuthClient();

  /**
   * "network" is a sentinel, not a school id. It consolidates every QuickBooks
   * book rather than summing the campuses — the four schools made $265,876 to
   * 7 September 2026 while the network made −$12,031, and only one of those is
   * the business. Restricted users do not get it: it would show them books they
   * cannot otherwise see.
   */
  const wantsNetwork = requestedSchool === "network" && ctx.hasUnrestrictedSchoolAccess;
  const network = wantsNetwork ? await getNetworkQuickBooksFigures(supabase) : null;

  const schoolId = resolvePrimarySchoolId(ctx, wantsNetwork ? undefined : requestedSchool);
  if (!schoolId) redirect("/dashboard");

  // Unrestricted roles carry an EMPTY accessibleSchoolIds — the encoding for
  // "all of them" — so the list is fetched rather than derived from that array.
  const { data: allSchools } = await supabase.from("schools").select("id, name").order("name");
  const selectableSchools = (allSchools ?? []).filter((s) => canAccessSchool(ctx, s.id));
  const currentSchoolName =
    selectableSchools.find((s) => s.id === schoolId)?.name ?? "Unnamed school";

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
        {/* The campus is in the title, not implied. Every figure on this page
            belongs to one school, and a page of money that does not say whose
            money it is invites exactly the wrong conclusion. */}
        <PageHeader
          title={`Financial Intelligence · ${wantsNetwork ? "Network" : currentSchoolName}`}
          subtitle={
            wantsNetwork
              ? "Every QuickBooks book consolidated — campuses, the parent entity, and anything else on the books"
              : "Profitability, forecasting, scenarios and executive analytics — for this campus only, before network costs"
          }
        />
        <ActionChipGroup>
          <ActionChip href="/dashboard/finance" size="sm">Finance</ActionChip>
          <ActionChip href="/dashboard/executive" size="sm">Executive Intelligence</ActionChip>
          <ActionChip href="/api/financial-intelligence/reports?type=classes" size="sm">Export CSV</ActionChip>
        </ActionChipGroup>
      </div>

      {selectableSchools.length > 1 ? (
        <nav className="flex flex-wrap gap-2" aria-label="Campus">
          {ctx.hasUnrestrictedSchoolAccess ? (
            <Link
              href="/dashboard/finance/intelligence?view=overview&school=network"
              aria-current={wantsNetwork ? "page" : undefined}
              className={
                wantsNetwork
                  ? "rounded-lg border border-brand-300 bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-800"
                  : "rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              }
            >
              Network
            </Link>
          ) : null}
          {selectableSchools.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/finance/intelligence?view=${view}&school=${s.id}`}
              aria-current={!wantsNetwork && s.id === schoolId ? "page" : undefined}
              className={
                !wantsNetwork && s.id === schoolId
                  ? "rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
                  : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              }
            >
              {s.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {network ? (
        network.ok ? (
          <NetworkOverview figures={network.figures} />
        ) : (
          /* The reason, never a zero. A consolidated figure nobody can trace is
             worse than a stated gap - that is the whole lesson of this file. */
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {network.reason}
          </div>
        )
      ) : (
        <>
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

      {/* The campus travels with the tab. FI_TABS carries a bare ?view= href, so
          without this a user who switched from Overview to Teachers would land
          silently back on their primary school - the same page of money, a
          different campus, nothing saying so. */}
      <ViewTabs
        tabs={FI_TABS.map(({ href, label, value }) => ({
          href: `${href}&school=${schoolId}`,
          label,
          value,
        }))}
        activeView={view}
      />

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
        </>
      )}
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
