import type { ExecutiveDeadlineAnalytics } from "@/lib/compliance/types";
import Link from "next/link";

interface ExecutiveDeadlineAnalyticsPanelProps {
  analytics: ExecutiveDeadlineAnalytics;
}

export function ExecutiveDeadlineAnalyticsPanel({ analytics }: ExecutiveDeadlineAnalyticsPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Enterprise Deadline Analytics</h2>
        <Link href="/dashboard/compliance" className="text-sm text-brand-600 hover:underline">
          Compliance Center →
        </Link>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Parent completion rate" value={`${analytics.parentCompletionRate}%`} />
        <Metric label="Student assignment completion" value={`${analytics.studentAssignmentCompletion}%`} />
        <Metric label="Teacher documentation compliance" value={`${analytics.teacherDocumentationCompliance}%`} />
        <Metric label="School compliance" value={`${analytics.schoolCompliance}%`} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <OverdueCard label="Family overdue items" count={analytics.familyOverdue} tone="rose" />
        <OverdueCard label="Student overdue items" count={analytics.studentOverdue} tone="amber" />
        <OverdueCard label="Staff overdue items" count={analytics.staffOverdue} tone="slate" />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function OverdueCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "rose" | "amber" | "slate";
}) {
  const colors = {
    rose: "border-rose-100 bg-rose-50 text-rose-800",
    amber: "border-amber-100 bg-amber-50 text-amber-900",
    slate: "border-slate-100 bg-slate-50 text-slate-800",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{count}</p>
    </div>
  );
}
