"use client";

import { useTransition } from "react";
import type { OperationsHubSummary } from "@/lib/operations-platform/types";
import { refreshOperationsAction } from "@/lib/operations-platform/actions";

export function OpsSummaryPanel({ summary }: { summary: OperationsHubSummary }) {
  const items = [
    ["Customers", summary.totalCustomers], ["Subscriptions", summary.activeSubscriptions],
    ["MRR", `$${summary.mrr.toFixed(0)}`], ["ARR", `$${summary.arr.toFixed(0)}`],
    ["Open Tickets", summary.openTickets], ["Incidents", summary.openIncidents],
    ["Platform Health", `${summary.platformHealthPct.toFixed(1)}%`], ["At Risk", summary.atRiskCustomers],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, val]) => (
        <div key={String(label)} className="rounded-xl border bg-white p-4 text-sm">
          <p className="text-slate-500">{String(label)}</p>
          <p className="text-xl font-bold">{String(val)}</p>
        </div>
      ))}
    </div>
  );
}

export function OpsMetricsGrid({ metrics }: { metrics: Array<[string, string | number]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(([label, val]) => (
        <div key={label} className="rounded-xl border bg-white p-3 text-sm">
          <p className="text-slate-500">{label}</p>
          <p className="text-lg font-bold">{String(val)}</p>
        </div>
      ))}
    </div>
  );
}

export function OpsTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: Array<{ key: string; label: string }> }) {
  if (!rows.length) return <p className="text-sm text-slate-500">No records yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left"><tr>{columns.map((c) => <th key={c.key} className="px-4 py-2 font-medium">{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => (
          <tr key={i} className="border-t">{columns.map((c) => <td key={c.key} className="px-4 py-2">{String(row[c.key] ?? "—")}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function RefreshOpsButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => refreshOperationsAction())}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
      {pending ? "Syncing…" : "Sync operations"}
    </button>
  );
}

export function AiReadinessNotice() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm">
      <h2 className="font-semibold">AI readiness (architecture only)</h2>
      <p className="mt-1 text-slate-600">Future: predict churn, recommend CS actions, forecast revenue, detect security anomalies. No AI in this release.</p>
    </section>
  );
}
