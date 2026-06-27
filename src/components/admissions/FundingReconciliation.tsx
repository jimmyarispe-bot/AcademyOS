import { formatCurrency } from "@/lib/format";

interface FundingReconciliationProps {
  summary: {
    expectedTotal: number;
    receivedTotal: number;
    variance: number;
    shortage: number;
    overpayment: number;
  };
  byAward: {
    id: string;
    studentName: string;
    expected: number;
    received: number;
    variance: number;
  }[];
}

export function FundingReconciliation({ summary, byAward }: FundingReconciliationProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Expected State Funding" value={formatCurrency(summary.expectedTotal)} />
        <MetricCard label="Payments Received" value={formatCurrency(summary.receivedTotal)} />
        <MetricCard
          label="Shortage"
          value={formatCurrency(summary.shortage)}
          variant={summary.shortage > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Overpayment"
          value={formatCurrency(summary.overpayment)}
          variant={summary.overpayment > 0 ? "warning" : "default"}
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900">Reconciliation by Student</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-4">Student</th>
                <th className="pb-2 pr-4">Expected</th>
                <th className="pb-2 pr-4">Received</th>
                <th className="pb-2">Variance</th>
              </tr>
            </thead>
            <tbody>
              {byAward.map((row) => (
                <tr key={row.id} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-900">{row.studentName}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatCurrency(row.expected)}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatCurrency(row.received)}</td>
                  <td
                    className={`py-2 font-medium ${
                      row.variance < 0 ? "text-red-600" : row.variance > 0 ? "text-emerald-600" : "text-slate-600"
                    }`}
                  >
                    {formatCurrency(row.variance)}
                  </td>
                </tr>
              ))}
              {byAward.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No reconciliation data yet. Record expected and received payments on state funding awards.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "danger" | "warning";
}) {
  const colors = {
    default: "border-slate-200 bg-white",
    danger: "border-red-200 bg-red-50",
    warning: "border-amber-200 bg-amber-50",
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[variant]}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
