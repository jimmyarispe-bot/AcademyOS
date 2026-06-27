import { StatCard } from "@/components/dashboard/StatCard";
import { formatCount, formatCurrency } from "@/lib/format";
import { FundingBreakdown } from "@/components/ui/FundingBreakdown";
import type { CeoDashboardMetrics } from "@/lib/admissions/ceo-metrics";

interface CeoDashboardViewProps {
  metrics: CeoDashboardMetrics;
}

export function CeoDashboardView({ metrics }: CeoDashboardViewProps) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Pipeline Value"
          value={formatCurrency(metrics.pipelineValue)}
          description="Forecasted tuition from pipeline"
          accent="indigo"
          icon={<span>$</span>}
        />
        <StatCard
          title="Enrollment Goal Progress"
          value={`${metrics.enrollmentProgress}%`}
          description={`Goal: ${formatCount(metrics.enrollmentGoal)} students`}
          accent="emerald"
          icon={<span>%</span>}
        />
        <StatCard
          title="State Funding Totals"
          value={formatCurrency(metrics.stateFundingTotals)}
          description="Received + forecasted"
          accent="sky"
          icon={<span>$</span>}
        />
        <StatCard
          title="Scholarship Totals"
          value={formatCurrency(metrics.scholarshipTotals)}
          description="Approved scholarship awards"
          accent="amber"
          icon={<span>$</span>}
        />
        <StatCard
          title="Forecasted Tuition"
          value={formatCurrency(metrics.forecastedTuition)}
          description="Projected annual revenue"
          accent="violet"
          icon={<span>$</span>}
        />
        <StatCard
          title="Marketing ROI"
          value={metrics.marketingRoi != null ? `${metrics.marketingRoi}x` : "—"}
          description="Revenue vs marketing spend"
          accent="rose"
          icon={<span>↗</span>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Conversion Funnel</h3>
          <ul className="mt-4 space-y-2">
            {metrics.conversionFunnel.map((step) => (
              <li key={step.label} className="flex justify-between text-sm">
                <span className="text-slate-600">{step.label}</span>
                <span className="font-medium text-slate-900">{step.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <FundingBreakdown
          byFunding={metrics.studentsByFundingSource}
          byCategory={{}}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownList title="Students by School" data={metrics.studentsBySchool} />
        <BreakdownList title="Leads by State (Funding)" data={metrics.studentsByState} />
      </div>
    </div>
  );
}

function BreakdownList({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-4 space-y-2">
        {Object.entries(data).map(([key, count]) => (
          <li key={key} className="flex justify-between text-sm">
            <span className="text-slate-600">{key}</span>
            <span className="font-medium text-slate-900">{count}</span>
          </li>
        ))}
        {Object.keys(data).length === 0 && (
          <li className="text-sm text-slate-400">No data yet</li>
        )}
      </ul>
    </div>
  );
}
