import { StatCard } from "@/components/dashboard/StatCard";
import { ComplianceTabs } from "@/components/compliance/ComplianceTabs";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCount } from "@/lib/format";
import { canAdminCompliance, canViewCompliance } from "@/lib/compliance/access";
import {
  getCategories,
  getComplianceDashboardStats,
  getDomainScores,
  getEscalationRules,
  getObligationDocuments,
  getObligations,
  getReminderSchedules,
} from "@/lib/compliance/queries";
import { buildComplianceIcsFeed } from "@/lib/compliance/calendar";
import { COMPLIANCE_TABS } from "@/lib/compliance/types";
import { getSchools } from "@/lib/hr/queries";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";

interface CompliancePageContentProps {
  searchParams: Promise<{ view?: string }>;
}

export async function CompliancePageContent({ searchParams }: CompliancePageContentProps) {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewCompliance(ctx)) redirect("/dashboard");

  const { view: rawView } = await searchParams;
  const validViews = new Set(COMPLIANCE_TABS.map((t) => t.value));
  const view = rawView && validViews.has(rawView as (typeof COMPLIANCE_TABS)[number]["value"])
    ? rawView
    : "dashboard";

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    "";

  const supabase = await createAuthClient();

  const [stats, obligations, categories, domainScores, documents, reminderSchedules, escalationRules, schools, calendarItems] =
    await Promise.all([
      getComplianceDashboardStats(supabase, schoolId || undefined),
      getObligations(supabase, { schoolId: schoolId || undefined, limit: 200 }),
      getCategories(supabase),
      getDomainScores(supabase, schoolId || undefined),
      getObligationDocuments(supabase),
      getReminderSchedules(supabase, schoolId || undefined),
      getEscalationRules(supabase, schoolId || undefined),
      getSchools(),
      buildComplianceIcsFeed(supabase, schoolId || undefined),
    ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Enterprise Compliance Center"
          subtitle="Single source of truth for obligations, deadlines, renewals, and compliance activity"
        />
        <Link href="/dashboard/executive" className="rounded-lg bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100">
          Executive Intelligence →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Upcoming" value={formatCount(stats.upcoming)} description="Next 30 days" accent="sky" icon={<span className="font-bold">U</span>} />
        <StatCard title="Overdue" value={formatCount(stats.overdue)} description="Needs escalation" accent="rose" icon={<span className="font-bold">!</span>} />
        <StatCard title="Compliance" value={`${stats.compliancePct}%`} description="Completion rate" accent="emerald" icon={<span className="font-bold">%</span>} />
        <StatCard title="Critical" value={formatCount(stats.criticalCount)} description="High-risk items" accent="amber" icon={<span className="font-bold">C</span>} />
      </div>

      <ViewTabs tabs={[...COMPLIANCE_TABS]} activeView={view} />

      <ComplianceTabs
        view={view}
        stats={stats}
        obligations={obligations}
        categories={categories}
        domainScores={domainScores}
        documents={documents}
        reminderSchedules={reminderSchedules}
        escalationRules={escalationRules}
        schools={schools}
        calendarItems={calendarItems}
        canAdmin={canAdminCompliance(ctx)}
        schoolId={schoolId}
      />
    </div>
  );
}

export function CompliancePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-100" />)}
      </div>
      <div className="h-11 rounded-xl bg-slate-100" />
      <div className="h-64 rounded-2xl bg-slate-100" />
    </div>
  );
}
