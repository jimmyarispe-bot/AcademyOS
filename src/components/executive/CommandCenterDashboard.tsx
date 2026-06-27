import { StatCard } from "@/components/dashboard/StatCard";
import { formatCount, formatCurrency } from "@/lib/format";
import type { CommandCenterMetrics, ExecutiveInsight } from "@/lib/executive/types";
import type { ExecutiveDeadlineAnalytics } from "@/lib/compliance/types";
import Link from "next/link";
import type { ExecutiveFinancialDashboard } from "@/lib/financial-intelligence/types";
import { ExecutiveFinancialPanel } from "@/components/financial-intelligence/FiPanels";
import { ExecutiveDeadlineAnalyticsPanel } from "@/components/executive/ExecutiveDeadlineAnalyticsPanel";

interface CommandCenterDashboardProps {
  metrics: CommandCenterMetrics;
  insights: ExecutiveInsight[];
  deadlineAnalytics?: ExecutiveDeadlineAnalytics;
  fiDashboard?: ExecutiveFinancialDashboard | null;
}

export function CommandCenterDashboard({ metrics, insights, deadlineAnalytics, fiDashboard }: CommandCenterDashboardProps) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Enrollment" value={formatCount(metrics.enrollment)} description={metrics.enrollmentTrendPct != null ? `${metrics.enrollmentTrendPct > 0 ? "+" : ""}${metrics.enrollmentTrendPct}% trend` : "Active enrollments"} accent="indigo" icon={<span className="font-bold">E</span>} />
        <StatCard title="Admissions Pipeline" value={formatCount(metrics.admissionsPipeline)} description="Active leads" accent="sky" icon={<span className="font-bold">A</span>} />
        <StatCard title="Revenue Collected" value={formatCurrency(metrics.revenue)} description={`Cash flow ${formatCurrency(metrics.cashFlow)} YTD`} accent="emerald" icon={<span className="font-bold">$</span>} />
        <StatCard title="Outstanding AR" value={formatCurrency(metrics.accountsReceivable)} description="Accounts receivable" accent="amber" icon={<span className="font-bold">AR</span>} />
        <StatCard title="Scholarships" value={formatCurrency(metrics.scholarships)} description="Applied to billing" accent="violet" icon={<span className="font-bold">S</span>} />
        <StatCard title="State Funding" value={formatCurrency(metrics.stateFunding)} description="Applied credits" accent="rose" icon={<span className="font-bold">F</span>} />
        <StatCard title="Success Score" value={metrics.avgSuccessScore != null ? String(metrics.avgSuccessScore) : "—"} description={`Attendance ${metrics.attendanceRate ?? "—"}%`} accent="indigo" icon={<span className="font-bold">SS</span>} />
        <StatCard title="Staffing" value={formatCount(metrics.staffingLevels)} description={`Payroll YTD ${formatCurrency(metrics.payrollYtd)}`} accent="sky" icon={<span className="font-bold">HR</span>} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Executive Insights</h2>
            <Link href="/dashboard/executive/risk" className="text-sm text-brand-600">Risk register →</Link>
          </div>
          <ul className="mt-4 space-y-3">
            {insights.map((insight) => (
              <li key={insight.id} className={`rounded-xl px-4 py-3 text-sm ${severityClass(insight.severity)}`}>
                <p className="font-medium">{insight.title}</p>
                <p className="mt-1 text-slate-600">{insight.body}</p>
                {insight.recommended_action && (
                  <p className="mt-2 text-xs font-medium text-slate-700">→ {insight.recommended_action}</p>
                )}
              </li>
            ))}
            {!insights.length && <li className="text-slate-500">No active insights. Queue processing generates insights automatically.</li>}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Mission Control</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span>Open items</span><span className="font-semibold">{metrics.missionControlOpen}</span></div>
            <div className="flex justify-between"><span>Overdue tasks</span><span className="font-semibold text-amber-700">{metrics.missionControlCritical}</span></div>
            <div className="flex justify-between"><span>Compliance alerts</span><span className="font-semibold text-rose-700">{metrics.complianceAlerts}</span></div>
            <div className="flex justify-between"><span>Intervention effectiveness</span><span className="font-semibold">{metrics.interventionEffectiveness != null ? `${metrics.interventionEffectiveness}%` : "—"}</span></div>
          </div>
          <Link href="/dashboard/mission-control" className="mt-4 inline-block text-sm text-brand-600 hover:underline">Open Mission Control →</Link>
        </article>
      </section>

      {deadlineAnalytics && <ExecutiveDeadlineAnalyticsPanel analytics={deadlineAnalytics} />}

      {fiDashboard && <ExecutiveFinancialPanel dashboard={fiDashboard} />}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/dashboard/compliance" label="Compliance Center" />
        <QuickLink href="/dashboard/work" label="Work Management" />
        <QuickLink href="/dashboard/admissions?view=executive" label="Admissions Executive" />
        <QuickLink href="/dashboard/executive/decisions" label="Decision Intelligence" />
        <QuickLink href="/dashboard/finance/intelligence" label="Financial Intelligence" />
        <QuickLink href="/dashboard/teacher/executive" label="Instruction Executive" />
        <QuickLink href="/dashboard/hr?view=analytics" label="Workforce Analytics" />
      </section>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-brand-700 hover:border-brand-200 hover:bg-brand-50">
      {label} →
    </Link>
  );
}

function severityClass(severity: string) {
  if (severity === "critical") return "bg-rose-50 border border-rose-100";
  if (severity === "warning") return "bg-amber-50 border border-amber-100";
  return "bg-slate-50 border border-slate-100";
}
