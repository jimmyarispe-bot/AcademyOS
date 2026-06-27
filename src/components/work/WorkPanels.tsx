"use client";

import Link from "next/link";
import { useTransition } from "react";
import { completeTaskAction } from "@/lib/work/actions";
import type { WorkTask, WorkloadBucket, MyWorkSummary } from "@/lib/work/types";

interface MyWorkPanelProps {
  summary: MyWorkSummary;
  workload: WorkloadBucket;
}

export function MyWorkPanel({ summary, workload }: MyWorkPanelProps) {
  const [pending, startTransition] = useTransition();

  function complete(id: string) {
    startTransition(async () => {
      await completeTaskAction(id);
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Today" value={summary.tasksToday} />
        <Stat label="This week" value={summary.tasksThisWeek} />
        <Stat label="Overdue" value={summary.overdue} tone="rose" />
        <Stat label="Approvals" value={summary.waitingApprovals} tone="amber" />
        <Stat label="Projects" value={summary.activeProjects} />
        <Stat label="Mission Control" value={summary.missionControlAlerts} />
      </section>

      <TaskSection title="Today" tasks={workload.today} pending={pending} onComplete={complete} />
      <TaskSection title="Overdue" tasks={workload.overdue} pending={pending} onComplete={complete} tone="rose" />
      <TaskSection title="This week" tasks={workload.thisWeek} pending={pending} onComplete={complete} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Active projects</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {workload.projects.filter((p) => p.status === "active").slice(0, 8).map((p) => (
            <li key={p.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{p.name}</span>
              <span className="text-slate-500">{p.completion_pct}% · {p.health_indicator}</span>
            </li>
          ))}
          {!workload.projects.filter((p) => p.status === "active").length && (
            <li className="text-slate-500">No active projects assigned to you.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "rose" | "amber" }) {
  const color = tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </article>
  );
}

function TaskSection({
  title,
  tasks,
  pending,
  onComplete,
  tone,
}: {
  title: string;
  tasks: WorkTask[];
  pending: boolean;
  onComplete: (id: string) => void;
  tone?: "rose";
}) {
  if (!tasks.length) return null;
  return (
    <section className={`rounded-2xl border bg-white p-5 ${tone === "rose" ? "border-rose-200" : "border-slate-200"}`}>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {tasks.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-slate-500">{t.due_date ?? "No due date"} · {t.status.replace(/_/g, " ")}</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/dashboard/tasks?id=${t.id}`} className="text-xs text-brand-600 hover:underline">Open</Link>
              <button
                type="button"
                disabled={pending}
                onClick={() => onComplete(t.id)}
                className="text-xs text-emerald-700 hover:underline disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
