import type { StudentReadinessSnapshot } from "@/lib/instruction/readiness";

export function ReadinessSnapshotPanel({ snapshot }: { snapshot: StudentReadinessSnapshot }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <h3 className="font-semibold text-slate-900">Student readiness snapshot</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        <SnapshotBlock title="Medical alerts" items={snapshot.medicalAlerts} empty="None" />
        <SnapshotBlock title="IEP / 504 accommodations" items={snapshot.iepAccommodations} empty="None on file" />
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">Instructional levels</p>
          <ul className="mt-2 space-y-1 text-slate-700">
            {Object.entries(snapshot.instructionalLevels).map(([k, v]) => (
              <li key={k} className="capitalize">{k}: {v ?? "—"}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">Active interventions</p>
          <ul className="mt-2 space-y-1 text-slate-700">
            {snapshot.activeInterventions.length
              ? snapshot.activeInterventions.map((i, idx) => (
                  <li key={idx}>{i.type}{i.goal ? ` — ${i.goal}` : ""}</li>
                ))
              : <li className="text-slate-400">None</li>}
          </ul>
        </div>
        <SnapshotBlock
          title="Recent attendance"
          items={snapshot.recentAttendance.map((a) => `${a.date}: ${a.status.replace(/_/g, " ")}`)}
          empty="No records"
        />
        <SnapshotBlock
          title="Recent behavior"
          items={snapshot.recentBehavior.map((b) => b.title)}
          empty="None this week"
        />
        <SnapshotBlock
          title="Parent communications"
          items={snapshot.openCommunications.map((c) => c.subject)}
          empty="None recent"
        />
        <SnapshotBlock
          title="Outstanding tasks"
          items={snapshot.outstandingTasks.map((t) => t.title)}
          empty="None open"
        />
      </div>
    </div>
  );
}

function SnapshotBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1 text-slate-700">
        {items.length ? items.map((item, i) => <li key={i}>{item}</li>) : <li className="text-slate-400">{empty}</li>}
      </ul>
    </div>
  );
}
