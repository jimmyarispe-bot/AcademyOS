import type { ReactNode } from "react";

import {
  arrangementLabel,
  channelLabel,
  closesLabel,
  isOffSquare,
  usd,
  type PlanRow,
  type SchoolSchedules,
} from "@/lib/finance/tuition-schedules-shared";

/**
 * One school's tuition arrangements.
 *
 * No "use client" and no state: this screen only reads. Instalment lists open
 * with <details>, so a family's full schedule is one click away without
 * shipping a byte of JavaScript to do it.
 *
 * What this screen refuses to blur, in the order it matters:
 *
 *   - A month-to-month family has NO year total. The cell says so in words
 *     rather than showing a dash that reads as missing data or a zero that
 *     reads as a settled debt.
 *   - "Nothing to close" is not a failure. Only a plan with a schedule can fail
 *     to add up, and only those are judged.
 *   - Money that does not arrive through Square is marked, because those are
 *     the families every Square reconciliation reports as unpaid.
 *   - Enrolled students with no plan are named. They are invisible everywhere
 *     else, and that is how a child attends a full year without an invoice.
 */

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-slate-400">{children}</span>;
}

function PlanRowView({ plan }: { plan: PlanRow }) {
  const closes = closesLabel(plan.closes);
  const offSquare = isOffSquare(plan.paymentChannel);
  const scheduled = plan.billingMode === "scheduled";

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{plan.student}</p>
        <p className="text-xs text-slate-500">{arrangementLabel(plan.billingMode)}</p>
        {plan.sourceDocument && !plan.sourceDocument.startsWith("No document") ? (
          <p className="mt-1 max-w-md truncate text-xs text-slate-400" title={plan.sourceDocument}>
            {plan.sourceDocument}
          </p>
        ) : null}
      </td>

      <td className="px-4 py-3 tabular-nums">
        {scheduled ? (
          <>
            <p className="text-slate-900">{usd(plan.remainingDue)}</p>
            <p className="text-xs text-slate-500">
              over {plan.instalmentCount} payment{plan.instalmentCount === 1 ? "" : "s"}
            </p>
          </>
        ) : (
          <>
            <p className="text-slate-900">{usd(plan.monthlyAmount)} / month</p>
            {/* Not a dash and not zero. There is no year figure for this
                family, and saying so is the whole point of the column. */}
            <p className="text-xs text-slate-500">no year total — month to month</p>
          </>
        )}
      </td>

      <td className="px-4 py-3">
        <p className={offSquare ? "font-medium text-amber-700" : "text-slate-700"}>
          {channelLabel(plan.paymentChannel)}
        </p>
        {offSquare ? (
          <p className="text-xs text-amber-700">Not in the Square export</p>
        ) : null}
      </td>

      <td className="px-4 py-3 tabular-nums">
        {plan.forgivenessAmount > 0 ? (
          <p className="text-slate-700">{usd(plan.forgivenessAmount)} forgiven</p>
        ) : null}
        {plan.overpaymentCredit > 0 ? (
          <p className="text-slate-700">{usd(plan.overpaymentCredit)} credit</p>
        ) : null}
        {plan.forgivenessAmount === 0 && plan.overpaymentCredit === 0 ? <Muted>—</Muted> : null}
      </td>

      <td className="px-4 py-3">
        <span
          className={
            closes.tone === "bad"
              ? "font-semibold text-red-700"
              : closes.tone === "ok"
                ? "text-emerald-700"
                : "text-slate-400"
          }
        >
          {closes.text}
        </span>
        {plan.closes === false ? (
          <p className="text-xs text-red-700">off by {usd(plan.unaccounted)}</p>
        ) : null}
      </td>
    </tr>
  );
}

function InstalmentList({ plan }: { plan: PlanRow }) {
  if (plan.instalments.length === 0) return null;
  return (
    <tr className="border-t border-slate-50 bg-slate-50/60">
      <td colSpan={5} className="px-4 py-2">
        <details>
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
            {plan.student} · {plan.instalments.length} payments
          </summary>
          <ul className="mt-2 space-y-1">
            {plan.instalments.map((i) => (
              <li key={i.id} className="flex items-baseline gap-3 text-xs">
                <span className="w-56 text-slate-600">{i.label}</span>
                <span className="w-24 text-right tabular-nums text-slate-900">{usd(i.amount)}</span>
                <span className={i.isPaid ? "text-emerald-700" : "text-slate-400"}>
                  {i.isPaid ? `paid${i.paidAt ? ` ${i.paidAt}` : ""}` : "unpaid"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </td>
    </tr>
  );
}

export function TuitionScheduleTable({ school }: { school: SchoolSchedules }) {
  const scheduled = school.plans.filter((p) => p.billingMode === "scheduled");

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{school.schoolName}</h2>
        <p className="text-sm text-slate-500">
          {school.plans.length} plan{school.plans.length === 1 ? "" : "s"}
          {school.monthlyCommitted > 0 ? ` · ${usd(school.monthlyCommitted)} / month recurring` : ""}
          {school.scheduledOwed > 0 ? ` · ${usd(school.scheduledOwed)} on schedules` : ""}
        </p>
      </div>

      {school.notClosing > 0 ? (
        <p
          className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-900"
          role="alert"
        >
          {school.notClosing} plan{school.notClosing === 1 ? " does" : "s do"} not add up. A
          schedule whose payments do not match what is owed will invoice the wrong amount.
        </p>
      ) : null}

      {school.offSquare > 0 ? (
        <p className="mt-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {school.offSquare} famil{school.offSquare === 1 ? "y pays" : "ies pay"} outside the Square
          recurring export. Reconciling Square against this list will report them as unpaid unless
          you skip them deliberately.
        </p>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">What they pay</th>
              <th className="px-4 py-2 font-medium">Where the money arrives</th>
              <th className="px-4 py-2 font-medium">Adjustments</th>
              <th className="px-4 py-2 font-medium">Arithmetic</th>
            </tr>
          </thead>
          <tbody>
            {school.plans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  No tuition plans at this school.
                </td>
              </tr>
            ) : (
              school.plans.map((plan) => <PlanRowView key={plan.planId} plan={plan} />)
            )}
          </tbody>
        </table>
      </div>

      {scheduled.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full">
            <tbody>
              {scheduled.map((plan) => (
                <InstalmentList key={plan.planId} plan={plan} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {school.unplanned.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            {school.unplanned.length} enrolled student
            {school.unplanned.length === 1 ? " has" : "s have"} no tuition arrangement
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Not an error on its own — a child may be on hold, or fully funded with nothing to
            collect. But nobody is invoicing them, and without this list nobody would notice.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-amber-900">
            {school.unplanned.map((u) => (
              <li key={u.studentId}>
                {u.student}
                {u.gradeLevel ? (
                  <span className="text-amber-700"> · {u.gradeLevel.replace(/_/g, " ")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
