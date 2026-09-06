import Link from "next/link";
import { TuitionScheduleTable } from "@/components/finance/TuitionScheduleTable";
import { listTuitionSchedules } from "@/lib/finance/tuition-schedules";
import { usd } from "@/lib/finance/tuition-schedules-shared";

export const dynamic = "force-dynamic";

export const metadata = { title: "Payment Schedules · The JAG™" };

export default async function PaymentSchedulesPage() {
  const result = await listTuitionSchedules();

  if ("error" in result) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/dashboard/finance" className="text-sm text-slate-500 hover:text-slate-700">
          ‹ Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Payment Schedules</h1>
        <div className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          {result.error}
        </div>
      </div>
    );
  }

  const monthly = result.schools.reduce((sum, s) => sum + s.monthlyCommitted, 0);
  const owed = result.schools.reduce((sum, s) => sum + s.scheduledOwed, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/dashboard/finance" className="text-sm text-slate-500 hover:text-slate-700">
        ‹ Back
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Payment Schedules</h1>
      <p className="mt-1 max-w-3xl text-slate-500">
        What every family owes for 2026-27 and how they pay it. A Schedule of Tuition Payments is a
        rendering of this, not the other way round.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Plans</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {result.totalPlans}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Recurring, per month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{usd(monthly)}</p>
          <p className="text-xs text-slate-500">month-to-month families only</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Owed on schedules</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{usd(owed)}</p>
          <p className="text-xs text-slate-500">across the school year</p>
        </div>
        <div
          className={
            result.totalNotClosing > 0
              ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
              : "rounded-2xl border border-slate-200 bg-white px-4 py-3"
          }
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Plans that do not add up</p>
          <p
            className={
              result.totalNotClosing > 0
                ? "mt-1 text-2xl font-semibold tabular-nums text-red-800"
                : "mt-1 text-2xl font-semibold tabular-nums text-slate-900"
            }
          >
            {result.totalNotClosing}
          </p>
          <p className="text-xs text-slate-500">
            {result.totalUnplanned} enrolled with no plan
          </p>
        </div>
      </div>

      {/* The two totals are deliberately not added together. One is a monthly
          commitment with no end date; the other is a balance across a year.
          A single "total revenue" figure made from both would be meaningless,
          and somebody would put it in a board pack. */}
      <p className="mt-3 text-xs text-slate-500">
        The two money figures are not added together. One is a recurring monthly charge with no end
        date; the other is a balance owed across the year. There is no honest sum of the two.
      </p>

      {result.schools.length === 0 ? (
        <p className="mt-8 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No tuition plans yet.
        </p>
      ) : (
        result.schools.map((school) => (
          <TuitionScheduleTable key={school.schoolName} school={school} />
        ))
      )}
    </div>
  );
}
