"use client";

import { useTransition } from "react";
import { formatCurrency } from "@/lib/format";
import type { NetworkDimensionRow, KpiRow, RiskItem, StrategicGoal, ForecastScenario } from "@/lib/executive/types";
import {
  createComplianceRequirementAction,
  createForecastScenarioAction,
  createGrantAction,
  createStrategicGoalAction,
  saveReportTemplateAction,
} from "@/lib/executive/actions";

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

export function NetworkDashboardPanel({ rows, title }: { rows: NetworkDimensionRow[]; title: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Dimension</th>
              <th className="px-3 py-2 text-right">Enrollment</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">AR</th>
              <th className="px-3 py-2 text-right">Success</th>
              <th className="px-3 py-2 text-right">Staff</th>
              <th className="px-3 py-2 text-right">Pipeline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={`${row.dimension}-${row.dimensionValue}`}>
                <td className="px-3 py-2 font-medium">{row.dimensionValue}</td>
                <td className="px-3 py-2 text-right">{row.enrollment}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(row.revenue)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(row.outstandingAr)}</td>
                <td className="px-3 py-2 text-right">{row.avgSuccessScore ?? "—"}</td>
                <td className="px-3 py-2 text-right">{row.activeStaff}</td>
                <td className="px-3 py-2 text-right">{row.pipelineLeads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function KpiCenterPanel({ kpis }: { kpis: KpiRow[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Strategic KPI Center</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">KPI</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-right">Actual</th>
              <th className="px-3 py-2 text-right">Target</th>
              <th className="px-3 py-2 text-right">Trend</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {kpis.map((k) => (
              <tr key={k.kpi_key}>
                <td className="px-3 py-2 font-medium">{k.display_name}</td>
                <td className="px-3 py-2 capitalize text-slate-500">{k.category}</td>
                <td className="px-3 py-2 text-right">{formatKpiValue(k.actual_value, k.unit)}</td>
                <td className="px-3 py-2 text-right">{formatKpiValue(k.target_value, k.unit)}</td>
                <td className="px-3 py-2 text-right">{k.trend_pct != null ? `${k.trend_pct > 0 ? "+" : ""}${k.trend_pct}%` : "—"}</td>
                <td className="px-3 py-2"><StatusBadge status={k.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RiskIntelligencePanel({ risks }: { risks: RiskItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Risk Intelligence</h2>
      <ul className="mt-4 space-y-3">
        {risks.map((r) => (
          <li key={r.id} className="rounded-xl border border-slate-100 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs capitalize text-slate-500">{r.risk_category.replace(/_/g, " ")} · {r.likelihood} likelihood · {r.impact} impact</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">Score {r.risk_score}</span>
            </div>
            {r.recommended_action && <p className="mt-2 text-slate-600">→ {r.recommended_action}</p>}
          </li>
        ))}
        {!risks.length && <li className="text-slate-500">No open risks detected.</li>}
      </ul>
    </section>
  );
}

export function ForecastingPanel({
  baseline,
  scenarios,
  schoolId,
  schools,
}: {
  baseline: Record<string, unknown> | null;
  scenarios: ForecastScenario[];
  schoolId: string;
  schools: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      {baseline && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Forecast tuition" value={formatCurrency(Number(baseline.forecast_tuition))} />
          <MetricCard label="Forecast scholarships" value={formatCurrency(Number(baseline.forecast_scholarships))} />
          <MetricCard label="Forecast payroll" value={formatCurrency(Number(baseline.forecast_payroll))} />
        </section>
      )}
      <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 max-w-lg" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await createForecastScenarioAction(new FormData(e.currentTarget)); e.currentTarget.reset(); }); }}>
        <h2 className="font-semibold">Scenario modeling</h2>
        <select name="school_id" defaultValue={schoolId} className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input name="scenario_name" placeholder="Scenario name" required className={inputClass} />
        <select name="scenario_type" className={inputClass}>
          <option value="baseline">Baseline</option>
          <option value="optimistic">Optimistic</option>
          <option value="pessimistic">Pessimistic</option>
          <option value="custom">Custom</option>
        </select>
        <input name="enrollment_growth_pct" type="number" placeholder="Enrollment growth %" className={inputClass} />
        <input name="scholarship_growth_pct" type="number" placeholder="Scholarship growth %" className={inputClass} />
        <input name="payroll_growth_pct" type="number" placeholder="Payroll growth %" defaultValue={5} className={inputClass} />
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Save scenario</button>
      </form>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Saved scenarios</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {scenarios.map((s) => (
            <li key={s.id} className="rounded-lg bg-slate-50 px-3 py-2">
              <span className="font-medium">{s.scenario_name}</span> — {s.scenario_type} · Enrollment {s.forecast_enrollment ?? "—"} · Tuition {formatCurrency(Number(s.forecast_tuition ?? 0))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function StrategicPlanningPanel({ goals, schools }: { goals: StrategicGoal[]; schools: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-6">
      <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 max-w-lg" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await createStrategicGoalAction(new FormData(e.currentTarget)); e.currentTarget.reset(); }); }}>
        <h2 className="font-semibold">Add strategic goal</h2>
        <select name="school_id" className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input name="title" placeholder="Goal title" required className={inputClass} />
        <textarea name="description" placeholder="Description" className={inputClass} />
        <select name="goal_type" className={inputClass}>
          <option value="organizational">Organizational</option>
          <option value="academic">Academic</option>
          <option value="financial">Financial</option>
          <option value="operational">Operational</option>
          <option value="growth">Growth</option>
        </select>
        <input name="target_date" type="date" className={inputClass} />
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Create goal</button>
      </form>
      <ul className="space-y-3">
        {goals.map((g) => (
          <li key={g.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex justify-between"><h3 className="font-semibold">{g.title}</h3><span className="text-sm">{g.progress_pct}%</span></div>
            <p className="mt-1 text-sm text-slate-600">{g.description}</p>
            {g.initiatives.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-500">
                {g.initiatives.map((i) => <li key={i.id}>• {i.title} ({i.status})</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComplianceCenterPanel({ items, schools }: { items: Record<string, unknown>[]; schools: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-6">
      <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 max-w-lg" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await createComplianceRequirementAction(new FormData(e.currentTarget)); }); }}>
        <h2 className="font-semibold">Track requirement</h2>
        <select name="school_id" className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select name="requirement_type" className={inputClass}>
          <option value="accreditation">Accreditation</option>
          <option value="state_approval">State approval</option>
          <option value="special_education">Special education</option>
          <option value="financial_audit">Financial audit</option>
          <option value="hr_compliance">HR compliance</option>
          <option value="safety">Safety</option>
        </select>
        <input name="title" placeholder="Requirement title" required className={inputClass} />
        <input name="due_date" type="date" className={inputClass} />
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Add</button>
      </form>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id as string} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span>{item.title as string}</span>
            <span className="capitalize text-slate-500">{item.status as string} · {item.due_date as string ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GrantsDashboardPanel({
  data,
  schools,
}: {
  data: { grants: Record<string, unknown>[]; totalAwarded: number; totalSpent: number; pipelineCount: number };
  schools: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total awarded" value={formatCurrency(data.totalAwarded)} />
        <MetricCard label="Total spent" value={formatCurrency(data.totalSpent)} />
        <MetricCard label="Pipeline" value={String(data.pipelineCount)} />
      </section>
      <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 max-w-lg" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await createGrantAction(new FormData(e.currentTarget)); }); }}>
        <h2 className="font-semibold">Add grant</h2>
        <select name="school_id" className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input name="grant_name" placeholder="Grant name" required className={inputClass} />
        <input name="funder_name" placeholder="Funder" className={inputClass} />
        <input name="award_amount" type="number" placeholder="Award amount" className={inputClass} />
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Add grant</button>
      </form>
      <ul className="space-y-2 text-sm">
        {data.grants.map((g) => (
          <li key={g.id as string} className="rounded-lg bg-slate-50 px-3 py-2">
            {g.grant_name as string} — {g.pipeline_stage as string} · {formatCurrency(Number(g.award_amount ?? 0))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BoardReportingPanel({ schoolId }: { schoolId: string }) {
  const year = new Date().getFullYear();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
      <h2 className="font-semibold">Board Reporting Center</h2>
      <p className="text-sm text-slate-600">Export board-ready reports combining enrollment, financial performance, student outcomes, staffing, scholarships, state funding, and risk indicators.</p>
      <div className="flex flex-wrap gap-3">
        <a href={`/api/executive/board-export?schoolId=${schoolId}&from=${year}-01-01`} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Download board CSV</a>
        <a href={`/api/finance/board-export?schoolId=${schoolId}&from=${year}-01-01`} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Finance detail CSV</a>
      </div>
      <p className="text-xs text-slate-500">PDF and presentation exports are architected via Report Studio templates. CSV is production-ready today.</p>
    </section>
  );
}

export function ReportingStudioPanel({ templates, schools }: { templates: Record<string, unknown>[]; schools: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-6">
      <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 max-w-lg" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { const fd = new FormData(e.currentTarget); fd.set("config", JSON.stringify({ metrics: ["enrollment", "revenue", "kpis"], filters: {} })); await saveReportTemplateAction(fd); }); }}>
        <h2 className="font-semibold">Save report template</h2>
        <select name="school_id" className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input name="name" placeholder="Report name" required className={inputClass} />
        <select name="report_type" className={inputClass}>
          <option value="board">Board</option>
          <option value="kpi">KPI</option>
          <option value="financial">Financial</option>
          <option value="enrollment">Enrollment</option>
          <option value="custom">Custom</option>
        </select>
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Save template</button>
      </form>
      <ul className="space-y-2 text-sm">
        {templates.map((t) => (
          <li key={t.id as string} className="rounded-lg bg-slate-50 px-3 py-2">{t.name as string} — {t.report_type as string}</li>
        ))}
      </ul>
    </div>
  );
}

export function BenchmarkingPanel({ rows, metric }: { rows: { label: string; value: number; rank: number; networkAvg: number; vsNetworkPct: number | null }[]; metric: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold capitalize">Benchmarking — {metric.replace(/_/g, " ")}</h2>
      <table className="mt-4 min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left">Rank</th>
            <th className="px-3 py-2 text-left">Entity</th>
            <th className="px-3 py-2 text-right">Value</th>
            <th className="px-3 py-2 text-right">Network avg</th>
            <th className="px-3 py-2 text-right">vs network</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="px-3 py-2">#{r.rank}</td>
              <td className="px-3 py-2 font-medium">{r.label}</td>
              <td className="px-3 py-2 text-right">{r.value}</td>
              <td className="px-3 py-2 text-right">{r.networkAvg}</td>
              <td className="px-3 py-2 text-right">{r.vsNetworkPct != null ? `${r.vsNetworkPct > 0 ? "+" : ""}${r.vsNetworkPct}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </article>
  );
}

function formatKpiValue(value: number | null, unit: string) {
  if (value == null) return "—";
  if (unit === "currency") return formatCurrency(value);
  if (unit === "percent") return `${value}%`;
  return String(value);
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    on_track: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    critical: "bg-rose-100 text-rose-800",
    unknown: "bg-slate-100 text-slate-600",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${colors[status] ?? colors.unknown}`}>{status.replace(/_/g, " ")}</span>;
}
