"use client";

import { useTransition } from "react";
import type { CloudHubSummary } from "@/lib/cloud-platform/types";
import { refreshCloudAction } from "@/lib/cloud-platform/actions";

export function CloudSummaryPanel({ summary }: { summary: CloudHubSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Customers" value={summary.totalCustomers} />
      <StatCard label="Subscriptions" value={summary.activeSubscriptions} />
      <StatCard label="Open tickets" value={summary.openTickets} />
      <StatCard label="Incidents" value={summary.openIncidents} />
      <StatCard label="MRR" value={summary.mrr} prefix="$" />
      <StatCard label="At risk" value={summary.atRiskCustomers} />
    </div>
  );
}

function StatCard({ label, value, prefix }: { label: string; value: number; prefix?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500 sm:text-sm">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
        {prefix}{typeof value === "number" ? (prefix ? value.toFixed(0) : value) : value}
      </p>
    </div>
  );
}

export function RefreshCloudButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => refreshCloudAction())}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? "Syncing…" : "Sync platform"}
    </button>
  );
}

export function CloudTable({
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
              <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {columns.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-3 py-2 text-slate-700 sm:px-4">
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

export function AiReadinessNotice() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:p-5">
      <h2 className="font-semibold text-slate-900">AI readiness (architecture only)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Future: predict churn, recommend upsells, summarize tickets, identify struggling customers.
        No AI in this release.
      </p>
    </section>
  );
}
