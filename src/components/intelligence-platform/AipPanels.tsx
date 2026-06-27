"use client";

import { useTransition } from "react";
import type { MonitoringSummary, CostSummary } from "@/lib/intelligence-platform/types";
import { refreshAipAction } from "@/lib/intelligence-platform/actions";

export function MonitoringPanel({ monitoring }: { monitoring: MonitoringSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Queued jobs" value={monitoring.queueHealth.queued} />
      <StatCard label="Running" value={monitoring.queueHealth.running} />
      <StatCard label="Failures" value={monitoring.failureCount} />
      <StatCard label="Est. daily cost" value={monitoring.estimatedDailyCost} prefix="$" />
    </div>
  );
}

function StatCard({ label, value, prefix }: { label: string; value: number; prefix?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {prefix}{typeof value === "number" ? value.toFixed(2) : value}
      </p>
    </div>
  );
}

export function RefreshAipButton() {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => refreshAipAction())}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Refreshing…" : "Refresh platform"}
    </button>
  );
}

export function ArchitectureNotice() {
  return (
    <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5">
      <h2 className="font-semibold text-amber-900">Architecture only — no AI implementation</h2>
      <p className="mt-1 text-sm text-amber-800">
        Release 12.5 provides governance, orchestration, permissions, auditing, and extensibility.
        All provider calls are simulated. Future modules must route through this platform.
      </p>
    </section>
  );
}

export function HistoryTable({
  rows,
  columns,
}: {
  rows: Record<string, unknown>[];
  columns: Array<{ key: string; label: string }>;
}) {
  if (!rows.length) return <p className="text-sm text-slate-500">No records yet.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-2 font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2 text-slate-700">
                  {String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CostPanel({ costs }: { costs: CostSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Daily</p>
        <p className="text-2xl font-bold">${costs.dailyCost.toFixed(4)}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Monthly</p>
        <p className="text-2xl font-bold">${costs.monthlyCost.toFixed(4)}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Organization total</p>
        <p className="text-2xl font-bold">${costs.organizationCost.toFixed(4)}</p>
      </div>
    </div>
  );
}

export function FutureUseCasesPanel() {
  const cases = [
    "Lesson planning", "Admissions summaries", "Scholarship recommendations",
    "Financial insights", "Executive summaries", "Report card narratives",
    "Behavior summaries", "Risk identification", "Parent communication drafts",
    "Teacher assistance", "Compliance reviews", "Decision Intelligence enhancements",
  ];

  return (
    <ul className="grid gap-2 sm:grid-cols-2 text-sm text-slate-600">
      {cases.map((c) => (
        <li key={c} className="rounded-lg bg-slate-50 px-3 py-2">→ {c}</li>
      ))}
    </ul>
  );
}
