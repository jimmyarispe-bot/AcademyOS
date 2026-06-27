type ProgressRecord = { assessment_date: string; current_level: number; domain?: string };
type LiteracyRecord = { literacy_level: number; literacy_step: number; mastery_date: string | null; created_at: string };
type AttendanceRecord = { attendance_date: string; status: string };
type GoalRecord = { title: string; goal_source: string; progress_pct: number; status: string; review_date?: string | null };
type EffectivenessRecord = {
  recorded_at: string;
  minutes_delivered: number;
  effectiveness_rating: string | null;
  progress_trend: string | null;
  student_academic_interventions?: { intervention_type: string } | { intervention_type: string }[] | null;
};

interface ProgressVisualizationPanelProps {
  academicProgress: ProgressRecord[];
  structuredLiteracy: LiteracyRecord[];
  attendance: AttendanceRecord[];
  goals: GoalRecord[];
  interventionEffectiveness: EffectivenessRecord[];
}

function BarChart({ records, title }: { records: { label: string; value: number }[]; title: string }) {
  const max = Math.max(...records.map((r) => r.value), 1);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {records.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No data yet.</p>
      ) : (
        <div className="mt-4 flex items-end gap-2 h-32">
          {records.map((r) => (
            <div key={r.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-brand-500"
                style={{ height: `${(r.value / max) * 100}%`, minHeight: "8px" }}
                title={String(r.value)}
              />
              <span className="text-[10px] text-slate-400 text-center leading-tight">{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDomain(records: ProgressRecord[], domain: string) {
  return records
    .filter((r) => r.domain === domain)
    .slice(-12)
    .map((r) => ({
      label: new Date(r.assessment_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: r.current_level,
    }));
}

export function ProgressVisualizationPanel({
  academicProgress,
  structuredLiteracy,
  attendance,
  goals,
  interventionEffectiveness,
}: ProgressVisualizationPanelProps) {
  const literacyChart = structuredLiteracy.slice(-12).map((r) => ({
    label: r.mastery_date
      ? new Date(r.mastery_date).toLocaleDateString("en-US", { month: "short" })
      : new Date(r.created_at).toLocaleDateString("en-US", { month: "short" }),
    value: r.literacy_level * 10 + r.literacy_step,
  }));

  const attendancePresent = attendance.filter((a) => a.status === "present" || a.status === "tardy").length;
  const attendanceRate = attendance.length ? Math.round((attendancePresent / attendance.length) * 100) : 0;

  const interventionMinutes = interventionEffectiveness.slice(-8).map((r) => {
    const iv = Array.isArray(r.student_academic_interventions)
      ? r.student_academic_interventions[0]
      : r.student_academic_interventions;
    return {
      label: new Date(r.recorded_at).toLocaleDateString("en-US", { month: "short" }),
      value: r.minutes_delivered,
      type: iv?.intervention_type ?? "Intervention",
    };
  });

  const goalsMet = goals.filter((g) => g.status === "met").length;
  const goalsAtRisk = goals.filter((g) => g.status === "at_risk").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Attendance (90 days)</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{attendanceRate}%</p>
          <p className="text-xs text-slate-400">{attendancePresent} of {attendance.length} sessions</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Goals met</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-600">{goalsMet}</p>
          <p className="text-xs text-slate-400">{goals.length} active goals</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Goals at risk</p>
          <p className="mt-1 text-3xl font-semibold text-amber-600">{goalsAtRisk}</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart records={groupByDomain(academicProgress, "reading")} title="Reading level progression" />
        <BarChart records={groupByDomain(academicProgress, "writing")} title="Writing level progression" />
        <BarChart records={groupByDomain(academicProgress, "math")} title="Mathematics level progression" />
        <BarChart records={literacyChart} title="Structured Literacy (level × 10 + step)" />
      </div>

      {interventionMinutes.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Intervention service delivery</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {interventionMinutes.map((r, i) => (
              <li key={i} className="flex justify-between">
                <span>{r.type} · {r.label}</span>
                <span className="font-medium">{r.value} min</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Unified goal completion</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {goals.map((g) => (
            <li key={g.title} className="flex items-center justify-between gap-2">
              <span>
                <span className="text-xs uppercase text-slate-400">{g.goal_source}</span> — {g.title}
              </span>
              <span className="font-medium text-brand-600">{g.progress_pct}%</span>
            </li>
          ))}
          {!goals.length && <li className="text-slate-500">No growth goals on file.</li>}
        </ul>
      </section>
    </div>
  );
}
