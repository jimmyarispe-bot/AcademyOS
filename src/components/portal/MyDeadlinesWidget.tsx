"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { DeadlineBucket } from "@/lib/compliance/types";
import { completePortalObligationAction } from "@/lib/compliance/deadline-actions";

interface PortalTask {
  id: string;
  title: string;
  dueDate?: string;
  category: string;
  studentId?: string;
  href?: string;
  actionType?: string;
  parentCanComplete?: boolean;
  status?: string;
  priority?: string;
}

interface MyDeadlinesWidgetProps {
  deadlines: DeadlineBucket;
  tasks: PortalTask[];
  students: { id: string; first_name: string; last_name: string }[];
}

type Section = "today" | "thisWeek" | "next30Days" | "overdue";

const SECTION_LABELS: Record<Section, string> = {
  today: "Today",
  thisWeek: "This Week",
  next30Days: "Next 30 Days",
  overdue: "Overdue",
};

function actionLabel(actionType?: string) {
  if (actionType === "pay") return "Pay";
  if (actionType === "upload") return "Upload";
  if (actionType === "sign") return "Sign";
  if (actionType === "complete") return "Complete";
  return "Open";
}

export function MyDeadlinesWidget({ deadlines, tasks, students }: MyDeadlinesWidgetProps) {
  const [filterStudentId, setFilterStudentId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<Section>("today");
  const [pending, startTransition] = useTransition();

  const filteredTasks = useMemo(() => {
    if (!filterStudentId) return tasks;
    return tasks.filter((t) => t.studentId === filterStudentId);
  }, [tasks, filterStudentId]);

  const sectionTasks = useMemo(() => {
    const map: Record<Section, PortalTask[]> = {
      today: [],
      thisWeek: [],
      next30Days: [],
      overdue: [],
    };
    const ids = {
      today: new Set(deadlines.today.map((d) => d.id)),
      thisWeek: new Set(deadlines.thisWeek.map((d) => d.id)),
      next30Days: new Set(deadlines.next30Days.map((d) => d.id)),
      overdue: new Set(deadlines.overdue.map((d) => d.id)),
    };
    for (const task of filteredTasks) {
      if (ids.overdue.has(task.id)) map.overdue.push(task);
      else if (ids.today.has(task.id)) map.today.push(task);
      else if (ids.thisWeek.has(task.id)) map.thisWeek.push(task);
      else if (ids.next30Days.has(task.id)) map.next30Days.push(task);
    }
    return map;
  }, [filteredTasks, deadlines]);

  const visible = sectionTasks[activeSection];

  function markComplete(id: string) {
    startTransition(async () => {
      await completePortalObligationAction(id);
    });
  }

  if (!tasks.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">My Deadlines</h2>
        <p className="mt-3 text-sm text-slate-500">No upcoming deadlines. You&apos;re all caught up.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">My Deadlines</h2>
        {students.length > 1 && (
          <select
            value={filterStudentId}
            onChange={(e) => setFilterStudentId(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="">All children</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(SECTION_LABELS) as Section[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={`rounded-full px-3 py-1 text-sm ${
              activeSection === key
                ? key === "overdue"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-brand-100 text-brand-800"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {SECTION_LABELS[key]} ({sectionTasks[key].length})
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {visible.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div>
              <p className="font-medium text-slate-900">{t.title}</p>
              <p className="text-xs text-slate-500">
                {t.dueDate ?? "No date"} · {t.category.replace(/_/g, " ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {t.href && (
                <Link href={t.href} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-brand-700 ring-1 ring-slate-200">
                  {actionLabel(t.actionType)}
                </Link>
              )}
              {t.parentCanComplete && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => markComplete(t.id)}
                  className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Mark done
                </button>
              )}
            </div>
          </li>
        ))}
        {!visible.length && (
          <li className="py-4 text-center text-sm text-slate-500">Nothing in this section.</li>
        )}
      </ul>
    </section>
  );
}
