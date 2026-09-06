"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { markShadowDaysComplete } from "@/lib/admissions/shadow-days-actions";
import type { ShadowDayCase } from "@/lib/admissions/shadow-days-shared";
import { gradeLabel } from "@/lib/constants/grades";

/**
 * One row per child whose shadow days are booked.
 *
 * The button says what it does and what follows, in that order, because the
 * consequence is not obvious: marking shadow days complete is what puts the
 * accept-or-deny decision in front of a school leader. Nobody should discover
 * that by noticing a new card on another page.
 *
 * The row disappears on success rather than the whole list refetching, so a
 * leader working down sixteen families keeps their place.
 */
export function ShadowDaysPanel({
  initial,
  canAct,
}: {
  initial: ShadowDayCase[];
  canAct: boolean;
}) {
  const [cases, setCases] = useState<ShadowDayCase[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function complete(c: ShadowDayCase) {
    setError(null);
    setBusyId(c.leadId);
    startTransition(async () => {
      const result = await markShadowDaysComplete(c.leadId);
      setBusyId(null);
      if (result && "error" in result && result.error) {
        setError(`${c.studentName}: ${result.error}`);
        return;
      }
      setCases((prev) => prev.filter((x) => x.leadId !== c.leadId));
      setDone((prev) => [...prev, c.studentName]);
    });
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        {done.length > 0 ? (
          <>
            <p className="font-medium text-slate-900">
              {done.length} marked complete: {done.join(", ")}
            </p>
            <p className="mt-1">
              Each one should now be waiting on{" "}
              <Link href="/dashboard/admissions/decisions" className="underline">
                the decisions page
              </Link>
              . If one is missing, the stage moved but its decision did not open — tell someone
              rather than repeating the click.
            </p>
          </>
        ) : (
          <p>No shadow days are in progress.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {done.length > 0 ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          Marked complete: {done.join(", ")} — now waiting on{" "}
          <Link href="/dashboard/admissions/decisions" className="underline">
            the decisions page
          </Link>
          .
        </div>
      ) : null}

      {cases.map((c) => (
        <div
          key={c.leadId}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">{c.studentName}</p>
              <p className="text-sm text-slate-500">
                {c.schoolName ?? "(no school)"}
                {c.grade ? ` · ${gradeLabel(c.grade)}` : ""}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {c.guardianName ?? "(no guardian on file)"}
                {c.guardianEmail ? ` · ${c.guardianEmail}` : ""}
                {c.guardianPhone ? ` · ${c.guardianPhone}` : ""}
              </p>
              {/* Days since the lead was created, which is not the same as days
                  since shadow days were booked — JAG does not hold the booked
                  date. Labelled for what it actually measures. */}
              <p className="mt-1 text-xs text-slate-400">
                In JAG {c.daysWaiting} day{c.daysWaiting === 1 ? "" : "s"}
              </p>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => complete(c)}
                disabled={!canAct || pending || busyId === c.leadId}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {busyId === c.leadId ? "Saving…" : "Shadow days complete"}
              </button>
              <p className="mt-1 max-w-[15rem] text-xs text-slate-500">
                Puts the accept-or-deny decision in front of the school leader.
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
