"use client";

import { useTransition } from "react";
import type { MonitoringSummary } from "@/lib/enterprise-data/types";
import { refreshEdpAction } from "@/lib/enterprise-data/actions";

export function MonitoringPanel({ monitoring }: { monitoring: MonitoringSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Imports" value={monitoring.importCount} sub={`${monitoring.failedImports} failed`} />
      <StatCard label="Exports" value={monitoring.exportCount} sub={`${monitoring.failedExports} failed`} />
      <StatCard label="Syncs" value={monitoring.syncCount} sub={`${monitoring.failedSyncs} failed`} />
      <StatCard label="Connectors" value={monitoring.connectorHealth.length} sub="health monitored" />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

export function RefreshEdpButton() {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => refreshEdpAction())}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Refreshing…" : "Refresh data platform"}
    </button>
  );
}

export function ImportWizardSteps({ currentStep }: { currentStep: string }) {
  const steps = ["upload", "mapping", "validation", "preview", "conflicts", "import", "verification", "report"];
  const idx = steps.indexOf(currentStep);

  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, i) => (
        <li
          key={step}
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
            i <= idx ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {step}
        </li>
      ))}
    </ol>
  );
}

export function HistoryTable({
  rows,
  columns,
}: {
  rows: Record<string, unknown>[];
  columns: Array<{ key: string; label: string }>;
}) {
  if (!rows.length) return <p className="text-sm text-slate-500">No history yet.</p>;

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

export function AiReadinessPanel() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
      <h2 className="font-semibold text-slate-900">AI readiness (architecture only)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Future capabilities: suggest mappings, clean imported data, detect duplicates, recommend corrections,
        identify anomalies, and generate migration summaries. No AI implementation in this release.
      </p>
    </section>
  );
}

export function MappingStudioPanel({
  templates,
}: {
  templates: Array<{ id: string; template_name: string; import_type: string; is_default: boolean }>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Visual field mapper — drag-and-drop mapping, reusable templates, transformation rules, lookup tables,
        conditional mappings, and preview validation.
      </p>
      <ul className="space-y-2">
        {templates.map((t) => (
          <li key={t.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <span className="font-medium">{t.template_name}</span>
            <span className="ml-2 text-slate-500">({t.import_type})</span>
            {t.is_default && <span className="ml-2 rounded bg-brand-100 px-2 py-0.5 text-xs text-brand-700">Default</span>}
          </li>
        ))}
        {!templates.length && <li className="text-slate-500">No mapping templates yet — save one from the import wizard.</li>}
      </ul>
    </div>
  );
}

export function QualityScorePanel({
  score,
  issues,
  actions,
}: {
  score: number;
  issues: Array<{ message: string; severity: string }>;
  actions: string[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Data quality score</h2>
        <span className="text-3xl font-bold text-brand-600">{score.toFixed(0)}</span>
      </div>
      <ul className="mt-4 space-y-1 text-sm text-slate-600">
        {issues.slice(0, 5).map((issue, i) => (
          <li key={i}>• [{issue.severity}] {issue.message}</li>
        ))}
      </ul>
      {actions.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Corrective actions</p>
          <ul className="mt-1 space-y-1 text-sm">
            {actions.map((a, i) => (
              <li key={i}>→ {a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ConnectorGrid({
  connectors,
}: {
  connectors: Array<{ connector_key: string; display_name: string; category: string; supports_sync: boolean }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {connectors.map((c) => (
        <div key={c.connector_key} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="font-medium text-slate-900">{c.display_name}</p>
          <p className="text-slate-500">{c.category}</p>
          {c.supports_sync && <span className="mt-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Sync</span>}
        </div>
      ))}
    </div>
  );
}
