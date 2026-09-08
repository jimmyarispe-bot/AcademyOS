import Link from "next/link";
import { getFounderBrief, type CampusLine } from "@/lib/dashboard/morning-brief/founder-brief-data";
import {
  getFounderFinancials,
  type FounderFinancials,
} from "@/lib/dashboard/morning-brief/founder-financials";

/**
 * Founder Morning Brief — revenue-first homepage.
 *
 * Server Component on purpose. The section registry pattern used elsewhere in
 * this codebase resolves "use client" components through a runtime map, which
 * the RSC renderer cannot link to a client boundary; every import here is
 * static and every component is server-rendered.
 *
 * Tiles whose inputs the platform does not yet hold render as "Not connected"
 * with the reason, never as $0. A zero here would read as a business result.
 */

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Card({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "muted" }) {
  return (
    <div
      className={`rounded-2xl border shadow-sm ${
        tone === "muted" ? "border-slate-200 bg-slate-50/70" : "border-slate-200/80 bg-white"
      }`}
    >
      {children}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "positive" | "pending";
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight ${
          accent === "pending" ? "text-slate-400" : accent === "positive" ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

/** "Jan – Aug 2026", or the raw dates if either fails to parse. */
function periodLabel(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} – ${endIso}`;
  }
  const m = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  return start.getFullYear() === end.getFullYear()
    ? `${m(start)} – ${m(end)} ${end.getFullYear()}`
    : `${m(start)} ${start.getFullYear()} – ${m(end)} ${end.getFullYear()}`;
}

/**
 * The two tiles that were "Not connected" until 2026-09-08.
 *
 * Every branch that cannot show a number shows the REASON instead, never a
 * zero. A $0 EBITDA reads as a business result; "No accrual figures synced yet"
 * reads as what it is.
 */
function ebitdaTile(fin: FounderFinancials) {
  if (fin.unavailable) {
    return { value: "Not connected", sub: fin.unavailable, accent: "pending" as const };
  }
  if (fin.ebitda == null) {
    const who = fin.booksExcluded.map((b) => b.company).join(", ");
    return {
      value: "Incomplete",
      sub: `Net income did not parse for ${who || "one or more books"}`,
      accent: "pending" as const,
    };
  }
  const period = periodLabel(fin.periodStart, fin.periodEnd);
  const books = `${fin.booksIncluded} book${fin.booksIncluded === 1 ? "" : "s"}`;
  return {
    value: money(fin.ebitda),
    sub: `Accrual · ${books} · ${period}`,
    accent: fin.ebitda >= 0 ? ("positive" as const) : undefined,
  };
}

function cashTile(fin: FounderFinancials) {
  if (fin.unavailable) {
    return { value: "Not connected", sub: fin.unavailable, accent: "pending" as const };
  }
  if (fin.cash == null) {
    return {
      value: "Not connected",
      sub: "No balance sheet came back from any book",
      accent: "pending" as const,
    };
  }

  // The runway half is a separate claim from the cash half, and it is stated
  // separately. A profitable period has no runway to report — saying so is not
  // the same as failing to compute one.
  const runway =
    fin.runwayMonths != null
      ? `${fin.runwayMonths.toFixed(1)} months at current burn`
      : fin.monthlyBurn == null
        ? "Profitable this period — no burn"
        : "Runway needs a positive cash balance";

  const caveat =
    fin.cashBooksMissing > 0
      ? ` · ${fin.cashBooksMissing} book${fin.cashBooksMissing === 1 ? "" : "s"} missing a balance sheet`
      : "";

  return {
    value: money(fin.cash),
    sub: `${runway}${caveat}`,
    accent: fin.cash >= 0 ? ("positive" as const) : undefined,
  };
}

function campusSubtitle(c: CampusLine): string {
  if (c.annualTuition == null) return "No tuition set";
  return `${money(c.annualTuition)} per year`;
}

export async function FounderMorningBrief({ orgName }: { orgName: string }) {
  const [brief, fin] = await Promise.all([getFounderBrief(), getFounderFinancials()]);
  const { campuses, totals, tasks } = brief;

  const ebitda = ebitdaTile(fin);
  const cash = cashTile(fin);

  // The gap list is what the platform does not hold. Once the books are
  // connected, payroll/costs and the cash balance are held - leaving them
  // listed would tell the founder to go and connect something already done.
  const resolved = fin.unavailable
    ? new Set<string>()
    : new Set(
        [
          fin.ebitda != null ? "Payroll and operating costs" : null,
          fin.cash != null ? "Cash balance" : null,
        ].filter(Boolean) as string[]
      );
  const missing = brief.missing.filter((m) => !resolved.has(m));

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const ranked = [...campuses].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
  const hasData = totals.students > 0 || totals.pipelineOpen > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Founder Morning Brief</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {orgName} · Network · {today}
          </p>
        </div>
        <p className="text-sm text-slate-500">
          {totals.students} enrolled · {totals.pipelineOpen} in pipeline
        </p>
      </header>

      {!hasData && (
        <Card tone="muted">
          <div className="px-5 py-6 text-sm text-slate-600">
            No students or leads are loaded yet. Once the roster and pipeline are in, every figure below
            fills in automatically.
          </div>
        </Card>
      )}

      {/* Consolidated position */}
      <Card>
        <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Consolidated position · {campuses.length} campuses
          </h2>
          <p className="text-xs text-slate-500">Contracted at list tuition</p>
        </div>
        <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
          <Tile
            label="Contracted revenue"
            value={totals.revenue == null ? "—" : money(totals.revenue)}
            sub={`${totals.students} students at list tuition`}
          />
          <Tile
            label="Pipeline at decision"
            value={totals.pipelineValue == null ? "—" : money(totals.pipelineValue)}
            sub={`${totals.pipelineClosing} families accepted or in review`}
            accent="positive"
          />
          <Tile
            label="Open pipeline"
            value={String(totals.pipelineOpen)}
            sub="Families not yet declined"
          />
          <Tile label="Adjusted EBITDA" value={ebitda.value} sub={ebitda.sub} accent={ebitda.accent} />
          <Tile label="Cash &amp; runway" value={cash.value} sub={cash.sub} accent={cash.accent} />
        </div>
      </Card>

      {/* By campus */}
      <Card>
        <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">By campus</h2>
          <p className="text-xs text-slate-500">Sorted by contracted revenue</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2 font-medium">Campus</th>
                <th className="px-3 py-2 text-right font-medium">Students</th>
                <th className="px-3 py-2 text-right font-medium">Past</th>
                <th className="px-3 py-2 text-right font-medium">Revenue</th>
                <th className="px-3 py-2 text-right font-medium">Pipeline</th>
                <th className="px-3 py-2 text-right font-medium">At decision</th>
                <th className="px-5 py-2 text-right font-medium">Pipeline value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranked.map((c) => (
                <tr key={c.schoolId}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{c.campus}</p>
                    <p className="text-xs text-slate-500">{campusSubtitle(c)}</p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-900">{c.students}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-400">{c.pastStudents}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium text-slate-900">
                    {c.revenue == null ? "—" : money(c.revenue)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{c.pipelineOpen}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-900">{c.pipelineClosing}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-emerald-700">
                    {c.pipelineValue == null ? "—" : money(c.pipelineValue)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50/70 font-medium">
                <td className="px-5 py-3 text-slate-900">Network</td>
                <td className="px-3 py-3 text-right tabular-nums">{totals.students}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-500">{totals.pastStudents}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {totals.revenue == null ? "—" : money(totals.revenue)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{totals.pipelineOpen}</td>
                <td className="px-3 py-3 text-right tabular-nums">{totals.pipelineClosing}</td>
                <td className="px-5 py-3 text-right tabular-nums text-emerald-700">
                  {totals.pipelineValue == null ? "—" : money(totals.pipelineValue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Revenue levers */}
        <Card>
          <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Revenue levers, biggest first</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            <li className="flex items-start gap-4 px-5 py-3">
              <span className="w-24 shrink-0 text-right text-base font-semibold tabular-nums text-emerald-700">
                {totals.pipelineValue == null ? "—" : `+${money(totals.pipelineValue)}`}
              </span>
              <span className="min-w-0">
                <Link href="/dashboard/admissions" className="font-medium text-slate-900 hover:underline">
                  Close the families already at decision
                </Link>
                <span className="block text-xs text-slate-500">
                  {totals.pipelineClosing} accepted or in review · Admissions owns this
                </span>
              </span>
            </li>
            <li className="flex items-start gap-4 px-5 py-3">
              <span className="w-24 shrink-0 text-right text-base font-semibold tabular-nums text-slate-900">
                {totals.pipelineOpen}
              </span>
              <span className="min-w-0">
                <Link href="/dashboard/admissions" className="font-medium text-slate-900 hover:underline">
                  Work the open pipeline
                </Link>
                <span className="block text-xs text-slate-500">
                  Families who have not declined · earlier stages need contact
                </span>
              </span>
            </li>
            <li className="flex items-start gap-4 px-5 py-3">
              <span className="w-24 shrink-0 text-right text-base font-semibold tabular-nums text-slate-900">
                {totals.pastStudents}
              </span>
              <span className="min-w-0">
                <Link href="/dashboard/students" className="font-medium text-slate-900 hover:underline">
                  Win back past students
                </Link>
                <span className="block text-xs text-slate-500">
                  Former and not-returning families already know you
                </span>
              </span>
            </li>
            <li className="flex items-start gap-4 px-5 py-3 opacity-60">
              <span className="w-24 shrink-0 text-right text-base font-semibold tabular-nums text-slate-400">
                —
              </span>
              <span className="min-w-0">
                <span className="font-medium text-slate-600">Fill empty seats</span>
                <span className="block text-xs text-slate-500">Needs seat capacity per campus</span>
              </span>
            </li>
            <li className="flex items-start gap-4 px-5 py-3 opacity-60">
              <span className="w-24 shrink-0 text-right text-base font-semibold tabular-nums text-slate-400">
                —
              </span>
              <span className="min-w-0">
                <span className="font-medium text-slate-600">Collect what is overdue</span>
                <span className="block text-xs text-slate-500">Needs payments and receivables</span>
              </span>
            </li>
          </ul>
        </Card>

        {/* Waiting on you */}
        <Card>
          <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Waiting on you</h2>
            <p className="text-xs text-slate-500">{tasks.length} open</p>
          </div>
          {tasks.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Nothing is waiting on you right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900">{t.name}</span>
                    <span className="block text-xs text-slate-500">
                      {[t.leadName, t.campus].filter(Boolean).join(" · ") || "Unassigned"}
                    </span>
                  </span>
                  <Link
                    href="/dashboard/admissions"
                    className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Honest gap list */}
      <Card tone="muted">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">To finish this brief</h2>
          <p className="mt-1 text-xs text-slate-500">
            These stay blank until they exist. Nothing here is estimated.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {missing.map((m) => (
              <li
                key={m}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
              >
                {m}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
