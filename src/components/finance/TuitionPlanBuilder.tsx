"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

import {
  buildPlan,
  formatUsd,
  standardSlots,
  type BuiltPlan,
  type PlanLineInput,
} from "@/lib/finance/plan-builder";
import { saveTuitionPlan } from "@/lib/finance/plan-editor-actions";
import {
  FIRST_PAYABLE_MONTHS,
  PAYMENT_CHANNELS,
  type PlanEditorContext,
} from "@/lib/finance/plan-editor-shared";

/**
 * Building one child's tuition plan.
 *
 * This screen exists to replace a person reading a price list and typing a
 * schedule into Word. Everything visible here is a consequence of an error that
 * practice actually produced:
 *
 *   The arithmetic updates as you choose, so a wrong total is visible before it
 *   is signed rather than after it is invoiced.
 *
 *   The discount applies itself. Alexander Pobuda's $1,000 was simply forgotten,
 *   and nobody noticed until a reconciliation a year later.
 *
 *   Scholarships are ticked from what the state actually awarded, not typed.
 *
 *   The instalments are shown in full before saving. Sixteen Florida schedules
 *   do not sum to their own stated balance, and every one of them looked right.
 *
 * The preview here and the figures written on save come from the SAME pure
 * function. The server recomputes from its own catalog read and does not trust
 * anything this component sends beyond the selection itself.
 */

interface Props {
  readonly ctx: PlanEditorContext;
  readonly canSave: boolean;
}

export function TuitionPlanBuilder({ ctx, canSave }: Props) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [awardIds, setAwardIds] = useState<string[]>(
    ctx.awards.filter((a) => a.status === "awarded").map((a) => a.id)
  );
  const [sibling, setSibling] = useState(false);
  const [prorationMonths, setProrationMonths] = useState<number>(12);
  const [firstMonth, setFirstMonth] = useState<string>("2026-08-25");
  const [mode, setMode] = useState<"scheduled" | "monthly_open">("scheduled");
  const [monthly, setMonthly] = useState("");
  const [channel, setChannel] = useState(ctx.existingPlan?.paymentChannel ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const lines: PlanLineInput[] = useMemo(
    () =>
      ctx.catalog
        .filter((c) => selected[c.catalogItemId] !== undefined)
        .map((c) => ({
          itemCode: c.itemCode,
          itemName: c.itemName,
          amount: c.amount,
          frequency: c.frequency,
          oneToOneSessionRate: c.oneToOneSessionRate,
          sessionsPerMonth:
            (selected[c.catalogItemId] ?? 0) > 0 ? selected[c.catalogItemId] : undefined,
          billedToFamily: c.billedToFamily,
        })),
    [ctx.catalog, selected]
  );

  /**
   * The live preview.
   *
   * buildPlan THROWS on a plan that owes money nothing collects, which is
   * correct — but a half-finished form hits that constantly, so here it is a
   * message rather than a crash. The same throw on the server is a refusal to
   * save.
   */
  const preview: { plan: BuiltPlan } | { problem: string } = useMemo(() => {
    if (mode !== "scheduled") return { problem: "" };
    if (lines.length === 0) return { problem: "" };
    try {
      return {
        plan: buildPlan({
          lines,
          bundleDiscounts: ctx.bundles.map((b) => ({
            name: b.name,
            packageItemCode: b.packageItemCode,
            minAdditionalItems: b.minAdditionalItems,
            amount: b.amount,
          })),
          siblingDiscountPercent: sibling ? 5 : undefined,
          scholarships: ctx.awards
            .filter((a) => awardIds.includes(a.id))
            .map((a) => ({ programName: a.programName, awardedAmount: a.awardedAmount })),
          proration:
            prorationMonths < 12
              ? { monthsAttending: prorationMonths, monthsInYear: 12 }
              : undefined,
          instalments: standardSlots(firstMonth),
        }),
      };
    } catch (e) {
      return { problem: e instanceof Error ? e.message : "Could not build that plan." };
    }
  }, [mode, lines, ctx.bundles, ctx.awards, awardIds, sibling, prorationMonths, firstMonth]);

  function toggle(catalogItemId: string, offeredOneToOne: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (catalogItemId in next) delete next[catalogItemId];
      else next[catalogItemId] = offeredOneToOne ? 4 : 0;
      return next;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveTuitionPlan({
        studentId: ctx.studentId,
        billingMode: mode,
        selectedItems: Object.entries(selected).map(([catalogItemId, sessionsPerMonth]) => ({
          catalogItemId,
          sessionsPerMonth,
        })),
        awardIds,
        siblingDiscountPercent: sibling ? 5 : 0,
        prorationMonths: prorationMonths < 12 ? prorationMonths : null,
        firstPayableMonth: firstMonth,
        monthlyAmount: mode === "monthly_open" ? Number(monthly) || null : null,
        paymentChannel: channel || null,
        notes: notes.trim() || null,
      });
      if (result && "error" in result) {
        setError(result.error ?? "Could not save the plan.");
        return;
      }
      setSaved(true);
    });
  }

  const plan = "plan" in preview ? preview.plan : null;

  return (
    <div className="space-y-6">
      {ctx.existingPlan ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">This student already has an active plan.</p>
          <p className="mt-1">
            {ctx.existingPlan.billingMode === "scheduled"
              ? `${formatUsd(ctx.existingPlan.remainingDue ?? 0)} owed on a schedule`
              : `${formatUsd(ctx.existingPlan.monthlyAmount ?? 0)} a month, no end date`}
            {ctx.existingPlan.sourceDocument ? ` · ${ctx.existingPlan.sourceDocument}` : ""}.
            Saving here supersedes it. The old one is kept, not deleted — a family
            can hold the schedule they signed.
          </p>
        </div>
      ) : null}

      {/* ---------------- what they are buying ---------------- */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          What {ctx.studentName.split(" ")[0]} is taking
        </h2>
        <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {ctx.catalog.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {ctx.schoolName} has no priced catalog items.
            </p>
          ) : (
            ctx.catalog.map((c) => {
              const on = c.catalogItemId in selected;
              return (
                <div key={c.catalogItemId} className="border-t border-slate-100 px-4 py-3 first:border-t-0">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(c.catalogItemId, c.offeredOneToOne)}
                      className="mt-1"
                    />
                    <span className="flex-1">
                      <span className="font-medium text-slate-900">{c.itemName}</span>
                      <span className="block text-xs text-slate-500">
                        {c.amount === null ? (
                          // Blank is not zero. An unpriced item may not be billed.
                          <span className="text-amber-700">No price set — cannot be billed yet</span>
                        ) : (
                          `${formatUsd(c.amount)} / ${c.frequency === "monthly" ? "month" : c.frequency === "annual" ? "year" : c.frequency}`
                        )}
                        {c.offeredOneToOne && c.oneToOneSessionRate !== null
                          ? ` · or ${formatUsd(c.oneToOneSessionRate)} per 1:1 session`
                          : ""}
                      </span>
                      {!c.billedToFamily ? (
                        <span className="block text-xs font-medium text-amber-700">
                          Provided by {c.providerSchoolName} — owed school to school, not billed to
                          this family
                        </span>
                      ) : null}
                    </span>
                  </label>

                  {on && c.offeredOneToOne ? (
                    <div className="mt-2 flex items-center gap-2 pl-7 text-sm">
                      <label className="text-slate-600" htmlFor={`sessions-${c.catalogItemId}`}>
                        1:1 sessions per month
                      </label>
                      <input
                        id={`sessions-${c.catalogItemId}`}
                        type="number"
                        min={0}
                        value={selected[c.catalogItemId] ?? 0}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [c.catalogItemId]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1 tabular-nums"
                      />
                      <span className="text-xs text-slate-500">0 = taken as a class</span>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ---------------- what pays for it ---------------- */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Scholarships
          </h2>
          {ctx.awards.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No awards recorded for this student.
            </p>
          ) : (
            ctx.awards.map((a) => (
              <label key={a.id} className="mt-2 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={awardIds.includes(a.id)}
                  disabled={a.status !== "awarded"}
                  onChange={() =>
                    setAwardIds((prev) =>
                      prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                    )
                  }
                  className="mt-1"
                />
                <span>
                  <span className="text-slate-900">{a.programName}</span>{" "}
                  <span className="tabular-nums text-slate-700">
                    {formatUsd(a.awardedAmount)}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {a.awardYear}
                    {a.status !== "awarded" ? ` · ${a.status} — cannot be applied` : ""}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Adjustments
          </h2>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={sibling}
              onChange={(e) => setSibling(e.target.checked)}
              className="mt-1"
            />
            <span>
              Sibling discount — 5% off this child
              {/* There is no table of sibling rules. A discount the system
                  invents is one nobody can defend to a parent, so it is
                  ticked by a person who knows the family. */}
              <span className="block text-xs text-slate-500">
                Applies to one child in a family only.
                {ctx.siblingsWithPlans.length > 0
                  ? ` Siblings on file: ${ctx.siblingsWithPlans
                      .map((s) => `${s.name}${s.hasSiblingDiscount ? " (already has it)" : ""}`)
                      .join(", ")}`
                  : ""}
              </span>
            </span>
          </label>

          <div className="text-sm">
            <label className="block text-slate-600" htmlFor="proration">
              Months attending
            </label>
            <select
              id="proration"
              value={prorationMonths}
              onChange={(e) => setProrationMonths(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
            >
              {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((m) => (
                <option key={m} value={m}>
                  {m === 12 ? "Full year — no proration" : `${m} of 12 months`}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm">
            <label className="block text-slate-600" htmlFor="first-month">
              First month they pay
            </label>
            <select
              id="first-month"
              value={firstMonth}
              onChange={(e) => setFirstMonth(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
            >
              {FIRST_PAYABLE_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm">
            <label className="block text-slate-600" htmlFor="channel">
              Where the money arrives
            </label>
            <select
              id="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
            >
              {PAYMENT_CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Families paying outside Square are otherwise reported as unpaid by every
              reconciliation.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- arrangement shape ---------------- */}
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Arrangement
        </h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "scheduled"}
              onChange={() => setMode("scheduled")}
            />
            A schedule — a year total paid on dated instalments
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "monthly_open"}
              onChange={() => setMode("monthly_open")}
            />
            Month to month — no end date
          </label>
        </div>

        {mode === "monthly_open" ? (
          <div className="mt-3 text-sm">
            <label className="block text-slate-600" htmlFor="monthly-amount">
              Monthly amount
            </label>
            <input
              id="monthly-amount"
              inputMode="decimal"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="mt-1 w-40 rounded-lg border border-slate-200 px-2 py-1 tabular-nums"
              placeholder="0.00"
            />
            {/* No year total is synthesised. 965 x 10 is not a debt anybody
                agreed to, and once it is in a column somebody reads it as one. */}
            <p className="mt-1 text-xs text-slate-500">
              No year total is recorded for a month-to-month family, because there isn&apos;t one.
            </p>
          </div>
        ) : null}
      </section>

      {/* ---------------- the arithmetic ---------------- */}
      {mode === "scheduled" && "problem" in preview && preview.problem ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {preview.problem}
        </div>
      ) : null}

      {plan ? (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              What this comes to
            </h2>
          </div>
          <dl className="divide-y divide-slate-100 text-sm">
            <Row label="Full year" value={formatUsd(plan.annualTuition)} />
            {plan.proratedTuition !== null ? (
              <Row
                label={`Prorated · ${plan.prorationLabel}`}
                value={formatUsd(plan.proratedTuition)}
              />
            ) : null}
            {plan.bundleDiscount > 0 ? (
              <Row
                label={plan.bundleDiscountName ?? "Bundle discount"}
                value={`− ${formatUsd(plan.bundleDiscount)}`}
              />
            ) : null}
            {plan.siblingDiscount > 0 ? (
              <Row label="Sibling discount" value={`− ${formatUsd(plan.siblingDiscount)}`} />
            ) : null}
            {plan.scholarshipTotal > 0 ? (
              <Row label="Scholarships" value={`− ${formatUsd(plan.scholarshipTotal)}`} />
            ) : null}
            <Row label="The family pays" value={formatUsd(plan.remainingDue)} strong />
            {plan.scholarshipSurplus > 0 ? (
              <Row
                label="Award beyond what is owed"
                value={formatUsd(plan.scholarshipSurplus)}
                tone="amber"
              />
            ) : null}
          </dl>

          {plan.warnings.length > 0 ? (
            <ul className="border-t border-slate-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {plan.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <details className="border-t border-slate-100 px-4 py-3">
            <summary className="cursor-pointer text-sm text-slate-600">
              The {plan.instalments.filter((i) => i.amount > 0).length} payments — they total{" "}
              {formatUsd(plan.instalmentTotal)}
            </summary>
            <ul className="mt-2 space-y-1">
              {plan.instalments.map((i) => (
                <li key={i.sequence} className="flex items-baseline gap-3 text-xs">
                  <span className="w-56 text-slate-600">{i.label}</span>
                  <span className="w-24 text-right tabular-nums text-slate-900">
                    {formatUsd(i.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}

      <div className="text-sm">
        <label className="block text-slate-600" htmlFor="plan-notes">
          Notes on this plan
        </label>
        <textarea
          id="plan-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
          placeholder="Anything a person reading this in a year would need to know."
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Saved.{" "}
          <Link href="/dashboard/finance/schedules" className="underline">
            See it on Payment Schedules
          </Link>
          .
        </div>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={!canSave || pending || (mode === "scheduled" && !plan)}
        className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {pending ? "Saving…" : ctx.existingPlan ? "Replace the plan" : "Save the plan"}
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "amber";
}) {
  return (
    <div className="flex items-baseline justify-between px-4 py-2">
      <dt className={tone === "amber" ? "text-amber-800" : "text-slate-600"}>{label}</dt>
      <dd
        className={
          strong
            ? "text-base font-semibold tabular-nums text-slate-900"
            : tone === "amber"
              ? "tabular-nums text-amber-800"
              : "tabular-nums text-slate-900"
        }
      >
        {value}
      </dd>
    </div>
  );
}
