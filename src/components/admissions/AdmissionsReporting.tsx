import { StatCard } from "@/components/dashboard/StatCard";
import { formatCount } from "@/lib/format";
import { programLabel } from "@/lib/constants/programs";
import { FundingBreakdown } from "@/components/ui/FundingBreakdown";
import type { getAdmissionsReporting } from "@/lib/admissions/queries";

interface AdmissionsReportingProps {
  report: Awaited<ReturnType<typeof getAdmissionsReporting>>;
}

export function AdmissionsReporting({ report }: AdmissionsReportingProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Leads"
          value={formatCount(report.total)}
          description="All admissions leads"
          accent="indigo"
          icon={<span className="text-lg font-bold">L</span>}
        />
        <StatCard
          title="In Pipeline"
          value={formatCount(report.inPipeline)}
          description="Active admissions leads"
          accent="sky"
          icon={<span className="text-lg font-bold">P</span>}
        />
        <StatCard
          title="Accepted"
          value={formatCount(report.accepted)}
          description="Accepted leads"
          accent="emerald"
          icon={<span className="text-lg font-bold">A</span>}
        />
        <StatCard
          title="Enrolled"
          value={formatCount(report.enrolled)}
          description="Converted to enrollment"
          accent="violet"
          icon={<span className="text-lg font-bold">E</span>}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Avg Days to Acceptance"
          value={
            report.velocity.avgDaysToAcceptance !== null
              ? `${report.velocity.avgDaysToAcceptance}d`
              : "—"
          }
          description={
            report.velocity.acceptedCount > 0
              ? `Based on ${report.velocity.acceptedCount} accepted leads`
              : "No accepted leads yet"
          }
          accent="emerald"
          icon={<span className="text-lg font-bold">→</span>}
        />
        <StatCard
          title="Avg Days to Enrollment"
          value={
            report.velocity.avgDaysToEnrollment !== null
              ? `${report.velocity.avgDaysToEnrollment}d`
              : "—"
          }
          description={
            report.velocity.enrolledCount > 0
              ? `Based on ${report.velocity.enrolledCount} enrolled leads`
              : "No enrolled leads yet"
          }
          accent="violet"
          icon={<span className="text-lg font-bold">→</span>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Pipeline by Stage</h3>
          <ul className="mt-4 space-y-2">
            {report.byStage.map((item) => (
              <li key={item.value} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{item.stage}</span>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{
                        width: report.total
                          ? `${Math.round((item.count / report.total) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <span className="w-8 text-right font-medium text-slate-900">{item.count}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Average Days in Stage</h3>
          {report.avgDaysByStage.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No stage history yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {report.avgDaysByStage.map((item) => (
                <li key={item.stage} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-medium text-slate-900">
                    {item.avgDays}d
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      (n={item.sampleSize})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
            <h3 className="text-sm font-semibold text-slate-900">By Program</h3>
            <ul className="mt-4 space-y-2">
              {Object.entries(report.byProgram).map(([key, count]) => (
                <li key={key} className="flex justify-between text-sm">
                  <span className="text-slate-600">
                    {key === "unassigned" ? "Unassigned" : programLabel(key)}
                  </span>
                  <span className="font-medium text-slate-900">{count}</span>
                </li>
              ))}
              {Object.keys(report.byProgram).length === 0 && (
                <li className="text-sm text-slate-400">No data</li>
              )}
            </ul>
          </div>

          <FundingBreakdown byFunding={report.byFunding} byCategory={report.byCategory} />
        </div>
      </div>
    </div>
  );
}
