import { StatCard } from "@/components/dashboard/StatCard";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { FundingBreakdown } from "@/components/ui/FundingBreakdown";
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
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";

export const FINANCE_TABS = [
  { href: "/dashboard/finance?view=invoices", label: "Invoices", value: "invoices" },
  { href: "/dashboard/finance?view=payments", label: "Payments", value: "payments" },
  { href: "/dashboard/finance?view=plans", label: "Tuition Plans", value: "plans" },
  { href: "/dashboard/finance?view=accounts", label: "Billing Accounts", value: "accounts" },
  { href: "/dashboard/finance?view=families", label: "Families", value: "families" },
  { href: "/dashboard/finance?view=forecast", label: "Forecast", value: "forecast" },
  { href: "/dashboard/finance/intelligence", label: "Intelligence", value: "intelligence" },
  { href: "/dashboard/finance/executive", label: "Executive", value: "executive" },
  { href: "/dashboard/admissions/state-funding", label: "State Funding", value: "state-funding" },
  { href: "/dashboard/scholarships", label: "Scholarships", value: "scholarships" },
  { href: "/dashboard/finance?view=create", label: "Create", value: "create" },
] as const;

interface FinancePageContentProps {
  searchParams: Promise<{ view?: string }>;
}

export async function FinancePageContent({ searchParams }: FinancePageContentProps) {
  const { view: rawView } = await searchParams;
  const validViews = new Set(FINANCE_TABS.map((tab) => tab.value));
  const view = rawView && validViews.has(rawView as (typeof FINANCE_TABS)[number]["value"])
    ? rawView
    : "invoices";

  const [stats, invoices, payments, plans, accounts, families, students, schools, forecast] =
    await Promise.all([
      getFinanceStats(),
      getInvoices(),
      getPayments(),
      getTuitionPlans(),
      getBillingAccounts(),
      getFamiliesForBilling(),
      getStudentsForBilling(),
      getSchools(),
      (async () => {
        const ctx = await getIdentityContext();
        const schoolId =
          ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
          ctx?.accessibleSchoolIds[0];
        const supabase = await createAuthClient();
        return schoolId ? getLatestForecast(supabase, schoolId) : null;
      })(),
    ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Finance & Billing"
        subtitle="Tuition plans, invoices, payments, and family billing accounts"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Billed" value={formatCurrency(stats.totalBilled)} description="All invoice totals" accent="indigo" icon={<span className="text-lg font-bold">B</span>} />
        <StatCard title="Collected" value={formatCurrency(stats.totalPaid)} description="Payments received" accent="emerald" icon={<span className="text-lg font-bold">C</span>} />
        <StatCard title="Outstanding" value={formatCurrency(stats.outstanding)} description="Unpaid balances" accent="amber" icon={<span className="text-lg font-bold">O</span>} />
        <StatCard title="Invoices" value={formatCount(stats.invoiceCount)} description="Total invoices" accent="sky" icon={<span className="text-lg font-bold">I</span>} />
      </div>

      <ViewTabs tabs={[...FINANCE_TABS]} activeView={view} />

      <FundingBreakdown
        title="Funding Report"
        byFunding={stats.byFunding}
        byCategory={stats.byCategory}
      />

      <FinanceTabs
        view={view}
        invoices={invoices}
        payments={payments}
        plans={plans}
        accounts={accounts}
        families={families}
        students={students}
        schools={schools}
        forecast={forecast}
        overdueCount={stats.overdueCount}
      />
    </div>
  );
}

export function FinancePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-11 rounded-xl bg-slate-100" />
      <div className="h-64 rounded-2xl bg-slate-100" />
    </div>
  );
}
