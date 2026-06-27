import Link from "next/link";
import { redirect } from "next/navigation";
import { StatCard } from "@/components/dashboard/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCurrency } from "@/lib/format";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";
import { exportLedgerForGl } from "@/lib/finance/ledger";
import { getLatestForecast } from "@/lib/finance/forecasting";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";

export default async function FinanceExecutivePage() {
  const ctx = await getIdentityContext();
  const canView =
    ctx?.permissions.includes("finance.executive") ||
    ctx?.permissions.includes("finance.view") ||
    ctx?.isEnterpriseAdmin;

  if (!canView) redirect("/dashboard/finance");

  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0] ||
    ctx?.orgAssignments[0]?.school_id;

  const supabase = await createAuthClient();
  const [metrics, forecast, ledgerSample] = await Promise.all([
    getFinanceExecutiveDashboard(supabase, schoolId || undefined),
    getLatestForecast(supabase, schoolId || undefined),
    schoolId
      ? exportLedgerForGl(supabase, schoolId, new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0], new Date().toISOString().split("T")[0])
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/dashboard/finance" className="text-sm text-slate-500 hover:text-brand-600">← Finance</Link>
      <PageHeader title="Executive Financial Intelligence" subtitle="Revenue, collections, forecasting, and board-ready metrics" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tuition billed" value={formatCurrency(metrics.totalBilled)} description="All invoices" accent="indigo" icon={<span className="font-bold">B</span>} />
        <StatCard title="Collected" value={formatCurrency(metrics.totalCollected)} description="Payments received" accent="emerald" icon={<span className="font-bold">C</span>} />
        <StatCard title="Outstanding AR" value={formatCurrency(metrics.outstanding)} description="Unpaid balances" accent="amber" icon={<span className="font-bold">AR</span>} />
        <StatCard title="Collection rate" value={`${metrics.collectionRate}%`} description="Billed vs collected" accent="sky" icon={<span className="font-bold">%</span>} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Scholarships applied" value={formatCurrency(metrics.scholarshipsAwarded)} description="On invoices" accent="violet" icon={<span className="font-bold">S</span>} />
        <StatCard title="State funding applied" value={formatCurrency(metrics.stateFundingApplied)} description="On invoices" accent="rose" icon={<span className="font-bold">F</span>} />
        <StatCard title="Tuition yield" value={`${metrics.tuitionYield}%`} description="Net of aid" accent="emerald" icon={<span className="font-bold">Y</span>} />
        <StatCard title="Forecast accuracy" value={metrics.forecastAccuracy != null ? `${metrics.forecastAccuracy}%` : "—"} description="Tuition forecast" accent="indigo" icon={<span className="font-bold">FA</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold">AR aging</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between"><span>Current</span><span>{formatCurrency(metrics.aging.current)}</span></li>
            <li className="flex justify-between"><span>1–30 days</span><span>{formatCurrency(metrics.aging.days30)}</span></li>
            <li className="flex justify-between"><span>31–60 days</span><span>{formatCurrency(metrics.aging.days60)}</span></li>
            <li className="flex justify-between"><span>90+ days</span><span>{formatCurrency(metrics.aging.days90plus)}</span></li>
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold">Revenue by program</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(metrics.revenueByProgram).map(([prog, amt]) => (
              <li key={prog} className="flex justify-between"><span>{prog}</span><span>{formatCurrency(amt)}</span></li>
            ))}
          </ul>
        </article>
        {forecast && (
          <article className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
            <h3 className="font-semibold">Forecast vs actual — {forecast.snapshot_name}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
              <div><p className="text-slate-500">Tuition</p><p>Forecast {formatCurrency(Number(forecast.forecast_tuition))} · Actual {formatCurrency(Number(forecast.actual_tuition))}</p></div>
              <div><p className="text-slate-500">Scholarships</p><p>Forecast {formatCurrency(Number(forecast.forecast_scholarships))} · Actual {formatCurrency(Number(forecast.actual_scholarships))}</p></div>
              <div><p className="text-slate-500">State funding</p><p>Forecast {formatCurrency(Number(forecast.forecast_state_funding))} · Actual {formatCurrency(Number(forecast.actual_state_funding))}</p></div>
            </div>
          </article>
        )}
        <article className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <h3 className="font-semibold">GL export readiness</h3>
          <p className="mt-2 text-sm text-slate-600">{ledgerSample.length} ledger transactions YTD with source module, student, family, program, and funding source tagging.</p>
          {schoolId && (
            <a
              href={`/api/finance/board-export?schoolId=${schoolId}`}
              className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Download board-ready CSV
            </a>
          )}
          <p className="mt-2 text-sm text-slate-600">
            Integrates with{" "}
            <Link href="/dashboard/mission-control" className="text-brand-600 hover:underline">Mission Control</Link>
            {" "}for overdue alerts and{" "}
            <Link href="/dashboard/ceo" className="text-brand-600 hover:underline">Executive Dashboard</Link>.
          </p>
        </article>
      </div>
    </div>
  );
}
