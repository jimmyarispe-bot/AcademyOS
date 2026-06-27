import { StatCard } from "@/components/dashboard/StatCard";
import { HrTabs } from "@/components/hr/HrTabs";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCount } from "@/lib/format";
import {
  computeHrStats,
  getCertifications,
  getEmployees,
  getPayrollRecords,
  getPositions,
  getSchools,
  getSubstitutes,
  getVolunteers,
} from "@/lib/hr/queries";
import { canAccessHrAdmin } from "@/lib/hr/access";
import { getRecruitingPipeline, getComplianceCenter } from "@/lib/hr/employee-profile";
import { getWorkforceAnalytics, getOrgChart } from "@/lib/hr/analytics";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";

export const HR_TABS = [
  { href: "/dashboard/hr?view=employees", label: "Employees", value: "employees" },
  { href: "/dashboard/hr?view=recruiting", label: "Recruiting", value: "recruiting" },
  { href: "/dashboard/hr?view=compliance", label: "Compliance", value: "compliance" },
  { href: "/dashboard/hr?view=positions", label: "Positions", value: "positions" },
  { href: "/dashboard/hr?view=certifications", label: "Certifications", value: "certifications" },
  { href: "/dashboard/hr?view=payroll", label: "Payroll", value: "payroll" },
  { href: "/dashboard/hr?view=analytics", label: "Analytics", value: "analytics" },
  { href: "/dashboard/hr?view=workforce", label: "Substitutes & Volunteers", value: "workforce" },
  { href: "/dashboard/hr?view=create", label: "Add", value: "create" },
] as const;

interface HrPageContentProps {
  searchParams: Promise<{ view?: string }>;
}

export async function HrPageContent({ searchParams }: HrPageContentProps) {
  const { view: rawView } = await searchParams;
  const validViews = new Set(HR_TABS.map((tab) => tab.value));
  const view = rawView && validViews.has(rawView as (typeof HR_TABS)[number]["value"])
    ? rawView
    : "employees";

  const ctx = await getIdentityContext();
  if (!ctx || !canAccessHrAdmin(ctx)) redirect("/dashboard");

  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0];

  const supabase = await createAuthClient();

  const [employees, positions, certifications, payroll, schools, recruiting, compliance, analytics, orgChart, substitutes, volunteers] =
    await Promise.all([
      getEmployees(),
      getPositions(),
      getCertifications(),
      getPayrollRecords(),
      getSchools(),
      getRecruitingPipeline(supabase, schoolId),
      getComplianceCenter(supabase, schoolId),
      getWorkforceAnalytics(supabase, schoolId),
      schoolId ? getOrgChart(supabase, schoolId) : Promise.resolve({ nodes: [], openPositions: [] }),
      getSubstitutes(schoolId),
      getVolunteers(schoolId),
    ]);

  const stats = computeHrStats(employees, certifications, payroll);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Human Capital & Workforce"
          subtitle="Recruiting, onboarding, credentials, payroll, and workforce analytics"
        />
        <Link href="/dashboard/employee" className="rounded-lg bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100">
          Employee portal →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active Staff" value={formatCount(stats.activeEmployees)} description="Active employees" accent="indigo" icon={<span className="text-lg font-bold">E</span>} />
        <StatCard title="Open Jobs" value={formatCount(recruiting.jobs.filter((j) => j.status === "open").length)} description="Recruiting pipeline" accent="sky" icon={<span className="text-lg font-bold">J</span>} />
        <StatCard title="Expiring Certs" value={formatCount(stats.expiringCerts)} description="Within 90 days" accent="amber" icon={<span className="text-lg font-bold">C</span>} />
        <StatCard title="Pending Payroll" value={formatCount(stats.pendingPayroll)} description="Awaiting approval" accent="violet" icon={<span className="text-lg font-bold">P</span>} />
      </div>

      <ViewTabs tabs={[...HR_TABS]} activeView={view} />

      <HrTabs
        view={view}
        employees={employees}
        positions={positions}
        certifications={certifications}
        payroll={payroll}
        schools={schools}
        jobs={recruiting.jobs}
        applications={recruiting.applications}
        compliance={compliance}
        analytics={analytics}
        orgChart={orgChart}
        substitutes={substitutes}
        volunteers={volunteers}
        canRunPayroll={ctx.permissions.includes("payroll.run") || ctx.permissions.includes("finance.payroll") || ctx.isEnterpriseAdmin}
      />
    </div>
  );
}

export function HrPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-100" />
      </div>
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
