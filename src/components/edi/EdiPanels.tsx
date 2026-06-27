import type { DecisionCard, ExecutiveScorecard, CapacitySnapshot, EdiScenarioResult } from "@/lib/edi/types";
import { formatCurrency } from "@/lib/format";
import {
  approveRecommendationAction,
  rejectRecommendationAction,
  refreshEdiAction,
  runEdiScenarioAction,
} from "@/lib/edi/actions";

function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === "critical"
      ? "bg-rose-50 text-rose-700"
      : priority === "high"
        ? "bg-amber-50 text-amber-800"
        : priority === "normal"
          ? "bg-sky-50 text-sky-700"
          : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>{priority}</span>;
}

export function DecisionCardPanel({ card, schoolId }: { card: DecisionCard; schoolId: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{card.domain} · {card.recommendationType.replace(/_/g, " ")}</p>
          <h3 className="mt-1 font-semibold text-slate-900">{card.issue}</h3>
        </div>
        <PriorityBadge priority={card.priority} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ExplainBlock label="What happened" value={card.whatHappened} />
        <ExplainBlock label="Why it happened" value={card.whyHappened} />
        <ExplainBlock label="Likely next" value={card.likelyNext} />
        <ExplainBlock label="Evidence" value={card.evidence} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Metric label="Financial impact" value={formatCurrency(card.financialImpact)} />
        <Metric label="Confidence" value={`${card.confidenceScore}%`} />
        <Metric label="Score" value={card.recommendationScore} />
        {card.currentMargin != null && <Metric label="Current margin" value={`${card.currentMargin.toFixed(1)}%`} />}
        {card.projectedMargin != null && <Metric label="Projected margin" value={`${card.projectedMargin.toFixed(1)}%`} />}
        {card.breakEvenEnrollment != null && <Metric label="Break-even" value={card.breakEvenEnrollment} />}
      </div>

      <p className="mt-4 font-medium text-brand-800">→ {card.recommendedAction}</p>

      {card.alternativeOptions.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
          {card.alternativeOptions.map((alt, i) => (
            <li key={i}>{alt.action}{alt.impact ? ` — ${alt.impact}` : ""}</li>
          ))}
        </ul>
      )}

      {card.id && (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={approveRecommendationAction}>
            <input type="hidden" name="school_id" value={schoolId} />
            <input type="hidden" name="recommendation_id" value={card.id} />
            <input type="hidden" name="financial_impact" value={card.financialImpact} />
            <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
              Approve
            </button>
          </form>
          <form action={rejectRecommendationAction}>
            <input type="hidden" name="school_id" value={schoolId} />
            <input type="hidden" name="recommendation_id" value={card.id} />
            <button type="submit" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Reject
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

export function DecisionCardList({ cards, schoolId }: { cards: DecisionCard[]; schoolId: string }) {
  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <DecisionCardPanel key={card.id ?? `${card.domain}-${card.recommendationType}-${card.entityKey}`} card={card} schoolId={schoolId} />
      ))}
      {!cards.length && (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No recommendations yet. Run refresh to generate decision intelligence.
        </p>
      )}
    </div>
  );
}

export function ExecutiveScorecardPanel({ scorecard }: { scorecard: ExecutiveScorecard }) {
  const items = [
    ["Financial Health", scorecard.financialHealth],
    ["Enrollment Health", scorecard.enrollmentHealth],
    ["Student Success", scorecard.studentSuccess],
    ["Teacher Effectiveness", scorecard.teacherEffectiveness],
    ["Compliance", scorecard.compliance],
    ["Growth", scorecard.growth],
    ["Parent Engagement", scorecard.parentEngagement],
    ["Operational Efficiency", scorecard.operationalEfficiency],
    ["Capacity", scorecard.capacity],
    ["Risk", scorecard.risk],
  ] as const;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <p className="text-sm text-brand-700">Overall Enterprise Health</p>
        <p className="text-4xl font-bold text-brand-900">{scorecard.overallEnterpriseHealth}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(([label, value]) => (
          <Metric key={label} label={label} value={value} />
        ))}
      </div>
    </section>
  );
}

export function CapacityPanel({ capacity }: { capacity: CapacitySnapshot }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Available seats" value={capacity.availableSeats} />
      <Metric label="Used seats" value={capacity.usedSeats} />
      <Metric label="Teacher utilization" value={`${capacity.teacherUtilizationPct}%`} />
      <Metric label="Room utilization" value={`${capacity.roomUtilizationPct}%`} />
      <Metric label="Schedule utilization" value={`${capacity.scheduleUtilizationPct}%`} />
      <Metric label="Campus utilization" value={`${capacity.campusUtilizationPct}%`} />
      <Metric label="Program utilization" value={`${capacity.programUtilizationPct}%`} />
      <Metric label="Virtual capacity (hrs)" value={capacity.virtualCapacityHours.toFixed(0)} />
    </section>
  );
}

export function ScenarioComparisonTable({
  scenarios,
}: {
  scenarios: Array<{
    id: string;
    name: string;
    scenario_type: string;
    edi_scenario_results?: Array<Record<string, unknown>>;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Scenario</th>
            <th className="px-4 py-3">Revenue</th>
            <th className="px-4 py-3">EBITDA</th>
            <th className="px-4 py-3">Enrollment</th>
            <th className="px-4 py-3">Margin %</th>
            <th className="px-4 py-3">Cash flow</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => {
            const r = s.edi_scenario_results?.[0];
            return (
              <tr key={s.id} className="border-b border-slate-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{r ? formatCurrency(Number(r.projected_revenue)) : "—"}</td>
                <td className="px-4 py-3">{r ? formatCurrency(Number(r.projected_ebitda)) : "—"}</td>
                <td className="px-4 py-3">{r ? Number(r.projected_enrollment).toFixed(0) : "—"}</td>
                <td className="px-4 py-3">{r ? `${Number(r.projected_margin_pct).toFixed(1)}%` : "—"}</td>
                <td className="px-4 py-3">{r ? formatCurrency(Number(r.projected_cash_flow)) : "—"}</td>
              </tr>
            );
          })}
          {!scenarios.length && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No scenarios computed yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ScenarioForm({ schoolId }: { schoolId: string }) {
  return (
    <form action={runEdiScenarioAction} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">Custom scenario</h3>
      <input type="hidden" name="school_id" value={schoolId} />
      <input name="name" placeholder="Scenario name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField name="tuition_change_pct" label="Tuition change %" />
        <NumberField name="enrollment_change_pct" label="Enrollment change %" />
        <NumberField name="teacher_hires" label="Teacher hires" />
        <NumberField name="class_size_increase" label="Class size increase %" />
        <NumberField name="sections_added" label="Sections added" />
        <NumberField name="sections_closed" label="Sections closed" />
      </div>
      <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Run scenario
      </button>
    </form>
  );
}

export function BriefingList({ briefings }: { briefings: Array<{ id: string; briefing_type: string; title: string; summary?: string; generated_at: string }> }) {
  return (
    <ul className="space-y-3">
      {briefings.map((b) => (
        <li key={b.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex justify-between gap-2">
            <span className="font-medium">{b.title}</span>
            <span className="text-xs capitalize text-slate-500">{b.briefing_type.replace(/_/g, " ")}</span>
          </div>
          {b.summary && <p className="mt-2 text-sm text-slate-600">{b.summary}</p>}
          <p className="mt-1 text-xs text-slate-400">{new Date(b.generated_at).toLocaleString()}</p>
        </li>
      ))}
      {!briefings.length && <li className="text-sm text-slate-500">No briefings generated yet.</li>}
    </ul>
  );
}

export function RefreshEdiButton() {
  return (
    <form action={refreshEdiAction}>
      <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Refresh decision intelligence
      </button>
    </form>
  );
}

export function EdiScorecardCompact({ scorecard }: { scorecard: ExecutiveScorecard }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Executive Scorecard</h2>
        <span className="text-2xl font-bold text-brand-700">{scorecard.overallEnterpriseHealth}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">Rules-based enterprise health — not AI</p>
    </section>
  );
}

function ExplainBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-slate-700">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function NumberField({ name, label }: { name: string; label: string }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <input name={name} type="number" step="any" defaultValue={0} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
    </label>
  );
}

export type { EdiScenarioResult };
