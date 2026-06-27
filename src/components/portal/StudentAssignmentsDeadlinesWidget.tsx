"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { ComplianceObligation } from "@/lib/compliance/types";
import { completePortalObligationAction } from "@/lib/compliance/deadline-actions";

interface StudentAssignmentsDeadlinesWidgetProps {
  dueToday: ComplianceObligation[];
  dueTomorrow: ComplianceObligation[];
  upcoming: ComplianceObligation[];
  overdue: ComplianceObligation[];
  completed: ComplianceObligation[];
}

type Section = "dueToday" | "dueTomorrow" | "upcoming" | "overdue" | "completed";

export function StudentAssignmentsDeadlinesWidget({
  dueToday,
  dueTomorrow,
  upcoming,
  overdue,
  completed,
}: StudentAssignmentsDeadlinesWidgetProps) {
  const [section, setSection] = useState<Section>("dueToday");
  const [priority, setPriority] = useState("");
  const [subject, setSubject] = useState("");
  const [pending, startTransition] = useTransition();

  const sections: Record<Section, ComplianceObligation[]> = {
    dueToday,
    dueTomorrow,
    upcoming,
    overdue,
    completed,
  };

  const filtered = useMemo(() => {
    let rows = sections[section];
    if (priority) rows = rows.filter((r) => r.priority === priority);
    if (subject) rows = rows.filter((r) => r.subject_domain === subject);
    return rows;
  }, [section, priority, subject, dueToday, dueTomorrow, upcoming, overdue, completed]);

  const subjects = useMemo(() => {
    const all = [...dueToday, ...dueTomorrow, ...upcoming, ...overdue, ...completed];
    return [...new Set(all.map((r) => r.subject_domain).filter(Boolean))] as string[];
  }, [dueToday, dueTomorrow, upcoming, overdue, completed]);

  function markComplete(id: string) {
    startTransition(async () => {
      await completePortalObligationAction(id);
    });
  }

  const tabs: { key: Section; label: string; count: number }[] = [
    { key: "dueToday", label: "Due Today", count: dueToday.length },
    { key: "dueTomorrow", label: "Due Tomorrow", count: dueTomorrow.length },
    { key: "upcoming", label: "Upcoming", count: upcoming.length },
    { key: "overdue", label: "Overdue", count: overdue.length },
    { key: "completed", label: "Completed", count: completed.length },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">My Assignments &amp; Deadlines</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSection(t.key)}
            className={`rounded-full px-3 py-1 text-sm ${
              section === t.key ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-600"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-4 space-y-2 text-sm">
        {filtered.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-slate-500">
                Due {item.due_date}
                {item.subject_domain ? ` · ${item.subject_domain.replace(/_/g, " ")}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {item.action_href && section !== "completed" && (
                <Link href={item.action_href} className="text-xs text-brand-600 hover:underline">
                  Open
                </Link>
              )}
              {section !== "completed" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => markComplete(item.id)}
                  className="text-xs text-emerald-700 hover:underline disabled:opacity-50"
                >
                  Done
                </button>
              )}
            </div>
          </li>
        ))}
        {!filtered.length && <li className="py-4 text-center text-slate-500">No items match your filters.</li>}
      </ul>
    </section>
  );
}
