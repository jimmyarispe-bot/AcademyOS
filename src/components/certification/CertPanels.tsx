"use client";

import { useTransition } from "react";
import { runCertificationAction, refreshHealthAction } from "@/lib/certification/actions";
import { LAUNCH_DOMAINS, READINESS_THRESHOLD, scoreToTrafficLight } from "@/lib/certification/types";

export function V1CertifiedBadge({ certified }: { certified: boolean }) {
  if (!certified) return null;
  return (
    <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-6 py-4 text-center">
      <p className="text-lg font-bold tracking-wide text-emerald-800">ACADEMYOS VERSION 1.0 CERTIFIED</p>
    </div>
  );
}

export function TrafficLight({ score }: { score: number }) {
  const light = scoreToTrafficLight(score);
  const colors = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" };
  return (
    <span className={`inline-block h-3 w-3 rounded-full ${colors[light]}`} title={`${score.toFixed(0)}%`} />
  );
}

export function LaunchReadinessPanel({ scores }: { scores: Record<string, number | boolean> | null }) {
  if (!scores) return <p className="text-sm text-slate-500">Run certification to generate launch readiness scores.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {LAUNCH_DOMAINS.map(({ key, label }) => {
        const val = Number(scores[key] ?? 0);
        return (
          <div key={key} className="flex items-center gap-3 rounded-xl border bg-white p-3 text-sm">
            <TrafficLight score={val} />
            <div>
              <p className="text-slate-500">{label}</p>
              <p className="text-lg font-bold">{val.toFixed(0)}</p>
            </div>
          </div>
        );
      })}
      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 sm:col-span-2 lg:col-span-4">
        <p className="text-slate-600">Overall Certification Score (threshold ≥ {READINESS_THRESHOLD})</p>
        <p className="text-3xl font-bold text-emerald-700">{Number(scores.overall_score ?? 0).toFixed(1)}</p>
      </div>
    </div>
  );
}

export function ReadinessPanel({ scores }: { scores: Record<string, number | boolean> | null }) {
  return <LaunchReadinessPanel scores={scores} />;
}

export function CertTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: Array<{ key: string; label: string }> }) {
  if (!rows.length) return <p className="text-sm text-slate-500">No results yet.</p>;
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

export function RunCertButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => runCertificationAction())}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
      {pending ? "Running…" : "Run full certification"}
    </button>
  );
}

export function RefreshHealthButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => refreshHealthAction())}
      className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
      {pending ? "Scanning…" : "Nightly health scan"}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pass: "bg-green-100 text-green-800", healthy: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800", failure: "bg-red-100 text-red-800",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-slate-100"}`}>{status}</span>;
}

export function BugSummaryPanel({ summary }: { summary: { open: number; regression: number; resolved: number; critical: number } | null }) {
  if (!summary) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {[
        ["Open", summary.open], ["Regression", summary.regression],
        ["Resolved", summary.resolved], ["Critical", summary.critical],
      ].map(([label, val]) => (
        <div key={String(label)} className="rounded-xl border bg-white p-3 text-sm">
          <p className="text-slate-500">{label}</p>
          <p className="text-xl font-bold">{val}</p>
        </div>
      ))}
    </div>
  );
}

const AUDIT_CATEGORY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  technical_debt: "Technical Debt",
  performance: "Performance",
  security: "Security Improvements",
  ui: "UI Improvements",
  accessibility: "Accessibility",
};

export function PlatformHealthReportPanel({ findings, summary }: {
  findings: Record<string, unknown>[];
  summary: Record<string, number>;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Platform Health Report</h2>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(summary).map(([cat, count]) => (
          <div key={cat} className="rounded-lg border bg-white p-3 text-sm">
            <p className="text-slate-500">{AUDIT_CATEGORY_LABELS[cat] ?? cat}</p>
            <p className="text-xl font-bold">{count}</p>
          </div>
        ))}
      </div>
      <CertTable rows={findings} columns={[
        { key: "category", label: "Category" },
        { key: "domain", label: "Domain" },
        { key: "title", label: "Finding" },
        { key: "recommendation", label: "Recommendation" },
      ]} />
    </section>
  );
}

export function V1LaunchCertificationPanel({ certified, scores }: { certified: boolean; scores: Record<string, number | boolean> | null }) {
  const badges = [
    "Production Ready", "Commercial SaaS Ready", "Mobile Ready", "Accessibility Certified",
    "Security Validated", "Performance Validated", "Integration Validated",
    "Scalability Validated", "Customer Ready",
  ];
  const overall = Number(scores?.overall_score ?? 0);
  const ready = certified && overall >= READINESS_THRESHOLD;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">AcademyOS Version 1.0 Enterprise — Final Launch Readiness</h2>
      <p className="mt-1 text-sm text-slate-600">
        {ready
          ? "All launch domains meet the certification threshold. AcademyOS is approved for commercial launch."
          : `Overall score ${overall.toFixed(1)}% — address open audit findings and re-run certification.`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {badges.map((b) => (
          <span key={b} className={`rounded-full px-3 py-1 text-xs font-medium ${ready ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
            {b}
          </span>
        ))}
      </div>
    </section>
  );
}
