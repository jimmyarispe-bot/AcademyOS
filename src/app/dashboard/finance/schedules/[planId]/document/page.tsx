import Link from "next/link";
import { redirect } from "next/navigation";

import { formatUsd } from "@/lib/finance/plan-builder";
import { loadScheduleDocument } from "@/lib/finance/schedule-document";
import { hasPermission } from "@/lib/platform/identity/authorization-service";
import { getIdentityContext } from "@/lib/platform/identity/context";

export const dynamic = "force-dynamic";

export const metadata = { title: "Schedule of Tuition Payments" };

/**
 * The family's document, rendered from the plan.
 *
 * Laid out to match the schedules families already hold, because they will read
 * this one next to last year's. Printed with the browser rather than a PDF
 * library: no new dependency, and what a school leader sees on screen is
 * exactly what a parent receives.
 *
 * THE REMAINING BALANCE IS CALCULATED HERE, NOT COPIED. Every hand-built
 * schedule printed "Remaining Balance: $0.00" as a claim, and three were wrong
 * by thousands. If the figures do not close, this document says so on its face
 * rather than asserting zero.
 */

interface Props {
  params: Promise<{ planId: string }>;
}

export default async function ScheduleDocumentPage({ params }: Props) {
  const { planId } = await params;

  const identity = await getIdentityContext();
  if (!identity) redirect("/login");
  if (!hasPermission(identity, "finance.view") && !hasPermission(identity, "finance.billing")) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-amber-900">
        This page needs the <span className="font-mono">finance.view</span> permission.
      </div>
    );
  }

  const doc = await loadScheduleDocument(planId);

  if ("error" in doc) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {doc.error}
        </div>
      </div>
    );
  }

  const closes = Math.abs(doc.remainingBalance) < 0.005;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Screen-only chrome. `print:hidden` keeps it off the page a family gets. */}
      <div className="mb-8 flex items-center justify-between print:hidden">
        <Link href="/dashboard/finance/schedules" className="text-sm text-slate-500 hover:text-slate-700">
          ‹ Payment Schedules
        </Link>
        <p className="text-sm text-slate-500">Print this page to PDF to send it.</p>
      </div>

      <header className="text-center">
        <h1 className="text-xl font-semibold uppercase tracking-wide text-slate-900">
          {doc.student}
        </h1>
        <p className="mt-1 text-slate-700">Schedule of Tuition Payments</p>
        <p className="text-slate-700">{doc.schoolYear} School Year</p>
        <p className="mt-1 text-sm text-slate-500">{doc.school}</p>
      </header>

      {doc.billingMode === "monthly_open" ? (
        <section className="mt-10">
          <div className="flex items-baseline justify-between border-b border-slate-300 pb-1">
            <h2 className="font-semibold text-slate-900">Monthly Tuition</h2>
            <span className="text-sm text-slate-500">Amount</span>
          </div>
          <div className="flex items-baseline justify-between py-2">
            <span className="text-slate-700">Due monthly</span>
            <span className="tabular-nums text-slate-900">{formatUsd(doc.monthlyAmount ?? 0)}</span>
          </div>
          {/* No year total, stated in words. A month-to-month family has not
              agreed to one, and printing a figure here would invent a debt. */}
          <p className="mt-4 text-sm text-slate-600">
            This is a month-to-month arrangement with no end date, so there is no annual total.
            Tuition continues monthly until either party ends it.
          </p>
        </section>
      ) : (
        <>
          <section className="mt-10">
            <div className="flex items-baseline justify-between border-b border-slate-300 pb-1">
              <h2 className="font-semibold text-slate-900">Tuition</h2>
              <span className="text-sm text-slate-500">Amount</span>
            </div>
            <Line label="Annual Tuition" value={doc.annualTuition} />
            {doc.proratedTuition !== null ? (
              <Line
                label={`Prorated${doc.prorationLabel ? ` — ${doc.prorationLabel}` : ""}`}
                value={doc.proratedTuition}
              />
            ) : null}
            <Line label="Total Tuition" value={doc.billingBasis} strong />
          </section>

          <section className="mt-8">
            <div className="flex items-baseline justify-between border-b border-slate-300 pb-1">
              <h2 className="font-semibold text-slate-900">Parent Portion Payment Schedule</h2>
              <span className="text-sm text-slate-500">Amount</span>
            </div>
            {doc.instalments.map((i, idx) => (
              <div
                key={`${i.label}-${idx}`}
                className="flex items-baseline justify-between py-1 text-sm"
              >
                <span className="text-slate-700">{i.label}</span>
                <span className="tabular-nums text-slate-900">{formatUsd(i.amount)}</span>
              </div>
            ))}

            <div className="mt-2 flex items-baseline justify-between border-t border-slate-300 pt-2">
              <span className="font-medium text-slate-900">Total Payments</span>
              <span className="font-medium tabular-nums text-slate-900">
                {formatUsd(doc.instalmentTotal)}
              </span>
            </div>

            {doc.forgivenessAmount > 0 ? (
              <div className="flex items-baseline justify-between py-1">
                <span className="text-slate-700">School Forgiveness</span>
                <span className="tabular-nums text-slate-900">
                  {formatUsd(doc.forgivenessAmount)}
                </span>
              </div>
            ) : null}

            {doc.overpaymentCredit > 0 ? (
              <div className="flex items-baseline justify-between py-1">
                <span className="text-slate-700">Credit to the family</span>
                <span className="tabular-nums text-slate-900">
                  {formatUsd(doc.overpaymentCredit)}
                </span>
              </div>
            ) : null}

            <div className="flex items-baseline justify-between border-t border-slate-300 pt-2">
              <span className="font-semibold text-slate-900">Remaining Balance</span>
              <span
                className={
                  closes
                    ? "font-semibold tabular-nums text-slate-900"
                    : "font-semibold tabular-nums text-red-700"
                }
              >
                {formatUsd(doc.remainingBalance)}
              </span>
            </div>

            {!closes ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
                These payments do not add up to what is owed. Do not send this to a family until it
                does.
              </p>
            ) : null}
          </section>

          {doc.forgivenessReason ? (
            <p className="mt-6 text-xs text-slate-500">{doc.forgivenessReason}</p>
          ) : null}
        </>
      )}

      <footer className="mt-12 text-xs text-slate-400">
        Generated from The JAG™ on {new Date().toLocaleDateString("en-US")}.
      </footer>
    </div>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
}) {
  // Null is not zero: a figure the plan does not hold is left out rather than
  // printed as nothing owed.
  if (value === null) return null;
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className={strong ? "font-medium text-slate-900" : "text-slate-700"}>{label}</span>
      <span
        className={strong ? "font-medium tabular-nums text-slate-900" : "tabular-nums text-slate-900"}
      >
        {formatUsd(value)}
      </span>
    </div>
  );
}
