import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCount } from "@/lib/format";
import { getExecutiveInstructionDashboard } from "@/lib/instruction/executive";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { redirect } from "next/navigation";

export default async function ExecutiveInstructionPage() {
  const ctx = await getIdentityContext();
  const canView =
    ctx?.permissions.includes("instruction.executive") ||
    ctx?.permissions.includes("teacher.manage") ||
    ctx?.isEnterpriseAdmin;

  if (!canView) {
    redirect("/dashboard/teacher");
  }

  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0] ||
    ctx?.orgAssignments[0]?.school_id;

  const supabase = await createAuthClient();
  const metrics = await getExecutiveInstructionDashboard(supabase, schoolId || undefined);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/dashboard/teacher" className="text-sm text-slate-500 hover:text-brand-600">← Teacher Workspace</Link>
      <PageHeader
        title="Executive Instruction Dashboard"
        subtitle="Organization-wide student growth, intervention effectiveness, and instructional compliance"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active staff" value={formatCount(metrics.activeTeachers)} description="Teachers & contractors" accent="indigo" icon={<span className="font-bold">S</span>} />
        <StatCard title="Sessions (MTD)" value={formatCount(metrics.sessionsThisMonth)} description={`${metrics.completionRate}% completed`} accent="sky" icon={<span className="font-bold">Ses</span>} />
        <StatCard title="Instructional hours" value={formatCount(metrics.instructionalHours)} description="Scheduled this month" accent="emerald" icon={<span className="font-bold">H</span>} />
        <StatCard title="Avg goal progress" value={`${metrics.avgGoalProgress}%`} description={`${metrics.goalsAtRisk} at risk`} accent="amber" icon={<span className="font-bold">G</span>} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Documentation" value={`${metrics.documentationRate}%`} description="Sessions with notes" accent="violet" icon={<span className="font-bold">D</span>} />
        <StatCard title="Avg caseload" value={formatCount(metrics.avgCaseloadGoals)} description="Goals per staff member" accent="rose" icon={<span className="font-bold">C</span>} />
        <StatCard title="Teams" value={formatCount(metrics.instructionalTeams)} description="Students with teams" accent="sky" icon={<span className="font-bold">T</span>} />
        <StatCard title="Service minutes" value={formatCount(metrics.interventionEffectiveness.totalMinutes)} description="Intervention delivery" accent="emerald" icon={<span className="font-bold">M</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Intervention effectiveness</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>Strong results: {metrics.interventionEffectiveness.strong}</li>
            <li>Moderate results: {metrics.interventionEffectiveness.moderate}</li>
            <li>Weak results: {metrics.interventionEffectiveness.weak}</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Program sessions (MTD)</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {Object.entries(metrics.programBreakdown).map(([program, count]) => (
              <li key={program} className="flex justify-between"><span>{program}</span><span className="font-medium">{count}</span></li>
            ))}
            {!Object.keys(metrics.programBreakdown).length && <li>No program data this month.</li>}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Goals by grade level</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {Object.entries(metrics.gradeBreakdown).map(([grade, count]) => (
              <li key={grade} className="flex justify-between"><span>Grade {grade}</span><span className="font-medium">{count}</span></li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Mission Control integration</h3>
          <p className="mt-2 text-sm text-slate-600">
            Instructional compliance alerts, goal review reminders, and meeting follow-ups sync to{" "}
            <Link href="/dashboard/mission-control" className="text-brand-600 hover:underline">Mission Control</Link>.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Organization metrics also surface on the{" "}
            <Link href="/dashboard/ceo" className="text-brand-600 hover:underline">Executive Dashboard</Link>.
          </p>
        </article>
      </div>
    </div>
  );
}
