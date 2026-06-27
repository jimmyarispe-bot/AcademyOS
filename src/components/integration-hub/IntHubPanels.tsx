"use client";

import { useTransition } from "react";
import { refreshIntegrationHubAction } from "@/lib/integration-hub/actions";
import type { IntegrationHubSummary } from "@/lib/integration-hub/types";

export function HubSummaryPanel({ summary }: { summary: IntegrationHubSummary | null }) {
  if (!summary) return <p className="text-sm text-slate-500">Loading integration summary…</p>;
  const items = [
    ["Connectors", summary.connectorCount], ["Active", summary.activeConnectors],
    ["Webhooks", summary.webhookCount], ["API Keys", summary.apiKeyCount],
    ["Events (24h)", summary.eventCount24h], ["Sync Failures", summary.syncFailureCount],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, val]) => (
        <div key={String(label)} className="rounded-xl border bg-white p-3 text-sm">
          <p className="text-slate-500">{String(label)}</p>
          <p className="text-xl font-bold">{val}</p>
        </div>
      ))}
    </div>
  );
}

export function ExecutiveDashboardPanel({ snapshot }: { snapshot: Record<string, unknown> | null }) {
  if (!snapshot) return null;
  const items = [
    ["Connected Systems", snapshot.connected_systems], ["Connector Health", `${Number(snapshot.connector_health_pct ?? 0).toFixed(0)}%`],
    ["Failed Syncs", snapshot.failed_syncs], ["Daily Transactions", snapshot.daily_transactions],
    ["Webhook Success", `${Number(snapshot.webhook_success_rate ?? 0).toFixed(0)}%`], ["API Usage", snapshot.api_usage_count],
    ["Data Volume (MB)", snapshot.external_data_volume_mb], ["Marketplace Revenue", snapshot.marketplace_revenue],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, val]) => (
        <div key={String(label)} className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm">
          <p className="text-indigo-700">{String(label)}</p>
          <p className="text-lg font-bold text-indigo-900">{String(val ?? 0)}</p>
        </div>
      ))}
    </div>
  );
}

export function MonitoringPanel({ summary }: { summary: IntegrationHubSummary | null }) {
  if (!summary) return null;
  const m = summary.monitoring;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[
        ["Connector Health", `${m.connectorHealthPct.toFixed(0)}%`],
        ["API Health", `${m.apiHealthPct.toFixed(0)}%`],
        ["Webhook Failures", m.webhookFailures],
        ["Sync Latency", `${m.syncLatencyMs}ms`],
        ["Webhook Success", `${m.webhookSuccessRate.toFixed(0)}%`],
        ["Queue", m.queueStatus],
      ].map(([label, val]) => (
        <div key={String(label)} className="rounded-xl border bg-white p-3 text-sm">
          <p className="text-slate-500">{String(label)}</p>
          <p className="text-lg font-bold">{val}</p>
        </div>
      ))}
    </div>
  );
}

export function IntHubTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: Array<{ key: string; label: string }> }) {
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

export function RefreshHubButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => refreshIntegrationHubAction())}
      className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
      {pending ? "Refreshing…" : "Refresh monitoring"}
    </button>
  );
}

export function AiReadinessNote() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
      <p className="font-medium text-slate-800">AI Readiness (architecture only)</p>
      <p className="mt-1">Future AI may suggest field mappings, recommend connectors, detect sync anomalies, and identify duplicate integrations. No AI is implemented.</p>
    </div>
  );
}
