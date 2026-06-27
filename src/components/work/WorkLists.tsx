import type { WorkProject, WorkTask, WorkExecutiveMetrics } from "@/lib/work/types";
import { executePlaybookAction } from "@/lib/work/actions";

export function ProjectsList({ projects }: { projects: WorkProject[] }) {
  return (
    <ul className="space-y-2">
      {projects.map((p) => (
        <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-sm capitalize text-slate-500">{p.project_type.replace(/_/g, " ")} · {p.status}</p>
            </div>
            <HealthBadge health={p.health_indicator} />
          </div>
          <div className="mt-3 flex gap-4 text-sm text-slate-600">
            <span>{p.completion_pct}% complete</span>
            {p.target_date && <span>Due {p.target_date}</span>}
          </div>
        </li>
      ))}
      {!projects.length && (
        <li className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No projects yet.
        </li>
      )}
    </ul>
  );
}

export function TasksList({ tasks }: { tasks: WorkTask[] }) {
  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex justify-between gap-2">
            <span className="font-medium">{t.title}</span>
            <span className="capitalize text-slate-500">{t.status.replace(/_/g, " ")}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t.work_projects?.name ? `${t.work_projects.name} · ` : ""}
            {t.due_date ? `Due ${t.due_date}` : "No due date"}
          </p>
        </li>
      ))}
      {!tasks.length && (
        <li className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No tasks match your filters.
        </li>
      )}
    </ul>
  );
}

export function PlaybooksList({
  playbooks,
  schoolId,
}: {
  playbooks: {
    id: string;
    name: string;
    description: string | null;
    project_type: string;
    estimated_duration_days: number | null;
  }[];
  schoolId?: string;
}) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {playbooks.map((pb) => (
        <li key={pb.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">{pb.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{pb.description ?? "Operational playbook"}</p>
          <p className="mt-2 text-xs capitalize text-slate-500">
            {pb.project_type.replace(/_/g, " ")}
            {pb.estimated_duration_days ? ` · ~${pb.estimated_duration_days} days` : ""}
          </p>
          <form action={executePlaybookAction} className="mt-4">
            <input type="hidden" name="playbook_id" value={pb.id} />
            {schoolId && <input type="hidden" name="school_id" value={schoolId} />}
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Run playbook
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export function WorkExecutivePanel({ metrics }: { metrics: WorkExecutiveMetrics }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">Executive work analytics</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Completion rate" value={`${metrics.completionRate}%`} />
        <Metric label="Delayed projects" value={metrics.delayedProjects} />
        <Metric label="Overdue tasks" value={metrics.overdueTasks} />
        <Metric label="Blocked tasks" value={metrics.blockedTasks} />
        <Metric label="Est. hours" value={metrics.totalEstimatedHours} />
        <Metric label="Actual hours" value={metrics.totalActualHours} />
        <Metric label="Upcoming milestones" value={metrics.upcomingMilestones} />
        <Metric label="Playbooks completed" value={metrics.playbookRunsCompleted} />
      </div>
    </section>
  );
}

function HealthBadge({ health }: { health: string }) {
  const cls =
    health === "green"
      ? "bg-emerald-50 text-emerald-700"
      : health === "yellow"
        ? "bg-amber-50 text-amber-800"
        : "bg-rose-50 text-rose-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>{health}</span>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
