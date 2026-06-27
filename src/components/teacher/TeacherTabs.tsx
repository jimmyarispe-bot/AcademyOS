import Link from "next/link";
import { Suspense } from "react";
import { SessionCardActions } from "@/components/teacher/TeacherSessionActions";
import { SessionReadinessCompact } from "@/components/instruction/SessionReadinessCompact";
import { EvidenceLibraryFilters } from "@/components/instruction/EvidenceLibraryFilters";
import type { StudentReadinessSnapshot } from "@/lib/instruction/readiness";
import {
  ArtifactForm,
  InterventionForm,
  LessonPlanForm,
  ParentMessageForm,
  ProgressRecordForm,
  TeacherNoteForm,
} from "@/components/teacher/TeacherWorkspaceForms";

type TodaySession = {
  id: string;
  timeDisplay: string;
  meet_link?: string | null;
  lessonStatus: string;
  roomName?: string | null;
  course?: { name?: string; academy_subject?: string; program?: string } | null;
  section?: { section_code?: string; delivery_mode?: string } | null;
  students: { id?: string; first_name?: string; last_name?: string; attendanceStatus?: string }[];
  alerts: { studentId: string; type: string; message: string }[];
};

interface TeacherMyDayProps {
  sessions: TodaySession[];
  readinessByStudent?: Map<string, StudentReadinessSnapshot>;
}

const alertColors: Record<string, string> = {
  medical: "bg-rose-50 text-rose-700",
  iep: "bg-violet-50 text-violet-700",
  behavior: "bg-amber-50 text-amber-700",
  funding: "bg-sky-50 text-sky-700",
};

export function TeacherMyDay({ sessions, readinessByStudent }: TeacherMyDayProps) {
  if (!sessions.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
        No sessions scheduled for today.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => {
        const firstStudent = session.students[0];
        const studentLabel =
          session.students.length > 1
            ? `${session.students.length} students`
            : firstStudent
              ? `${firstStudent.first_name} ${firstStudent.last_name}`
              : "No enrollments";

        return (
          <article key={session.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-brand-600">{session.timeDisplay}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {session.course?.name ?? "Session"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {session.section?.section_code} · {session.course?.academy_subject?.replace(/_/g, " ") ?? "—"} ·{" "}
                  {session.course?.program ?? session.section?.delivery_mode ?? "—"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {studentLabel}
                  {firstStudent?.id && (
                    <Link
                      href={`/dashboard/teacher/students/${firstStudent.id}`}
                      className="ml-2 text-brand-600 hover:underline"
                    >
                      Growth plan →
                    </Link>
                  )}
                </p>
              </div>
              <div className="text-right text-sm">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                  {session.lessonStatus.replace(/_/g, " ")}
                </span>
                <p className="mt-2 text-slate-500">
                  {session.meet_link ? (
                    <a href={session.meet_link} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                      Google Meet
                    </a>
                  ) : session.roomName ? (
                    session.roomName
                  ) : (
                    "Virtual"
                  )}
                </p>
              </div>
            </div>

            {session.alerts.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {session.alerts.map((a, i) => (
                  <li
                    key={i}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${alertColors[a.type] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {a.type}: {a.message}
                  </li>
                ))}
              </ul>
            )}

            {session.students.map((s) => {
              if (!s.id || !readinessByStudent?.has(s.id)) return null;
              return (
                <SessionReadinessCompact
                  key={s.id}
                  studentId={s.id}
                  studentName={`${s.first_name ?? ""} ${s.last_name ?? ""}`.trim()}
                  snapshot={readinessByStudent.get(s.id)!}
                />
              );
            })}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                {session.students.map((s) => (
                  <span key={s.id} className="rounded bg-slate-50 px-2 py-1">
                    {s.first_name}: {String(s.attendanceStatus).replace(/_/g, " ")}
                  </span>
                ))}
              </div>
              {session.students.length ? (
                <SessionCardActions
                  sessionId={session.id}
                  students={session.students as { id: string; first_name?: string; last_name?: string }[]}
                  lessonStatus={session.lessonStatus}
                />
              ) : (
                <Link
                  href={`/dashboard/teacher/sessions/${session.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open workspace
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

interface ProgressChartProps {
  records: { assessment_date: string; current_level: number; domain?: string }[];
  title: string;
}

export function ProgressChart({ records, title }: ProgressChartProps) {
  const maxLevel = Math.max(...records.map((r) => r.current_level), 3);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {records.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No progress data yet.</p>
      ) : (
        <div className="mt-4 flex items-end gap-2 h-32">
          {records.map((r) => (
            <div key={r.assessment_date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-brand-500"
                style={{ height: `${(r.current_level / maxLevel) * 100}%`, minHeight: "8px" }}
                title={`Level ${r.current_level}`}
              />
              <span className="text-[10px] text-slate-400">
                {new Date(r.assessment_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TeacherTabsPanelProps {
  view: string;
  sessions: TodaySession[];
  workload: Record<string, number>;
  compliance: { type: string; severity: string; title: string; href?: string }[];
  lessonPlans: { id: string; title: string; subject_domain?: string | null; status: string }[];
  notes: { id: string; title: string; category: string; body: string; tags: string[] }[];
  aiConfig: { capabilities?: Record<string, boolean> } | null;
  progressByDomain: Record<string, { assessment_date: string; current_level: number }[]>;
  rosterStudents: { id: string; first_name?: string; last_name?: string }[];
  interventions: { id: string; intervention_type: string; goal_text?: string | null; review_date?: string | null; students?: unknown }[];
  outreach: { id: string; subject: string; message_type: string; status: string; sent_at?: string | null }[];
  collaborationFeed: { id: string; title: string; body?: string | null; occurred_at: string; event_type: string; students?: unknown }[];
  qualityMetrics: Record<string, number>;
  schoolQuality: Record<string, number> | null;
  evidenceLibrary: { id: string; title: string; artifact_type: string; created_at: string }[];
  readinessByStudent?: Map<string, StudentReadinessSnapshot>;
  evidenceFilterBasePath?: string;
}

export function TeacherTabsPanel({
  view,
  sessions,
  workload,
  compliance,
  lessonPlans,
  notes,
  aiConfig,
  progressByDomain,
  rosterStudents,
  interventions,
  outreach,
  collaborationFeed,
  qualityMetrics,
  schoolQuality,
  evidenceLibrary,
  readinessByStudent,
  evidenceFilterBasePath = "/dashboard/teacher",
}: TeacherTabsPanelProps) {
  if (view === "my-day") return <TeacherMyDay sessions={sessions} readinessByStudent={readinessByStudent} />;

  if (view === "workload") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Sessions today", workload.sessionsToday],
          ["Students served", workload.studentsServed],
          ["Weekly hours", workload.weeklyHours],
          ["Service minutes (MTD)", workload.serviceMinutes],
          ["Active interventions", workload.activeInterventions],
          ["Parent messages sent", workload.sentParentMessages],
          ["Draft messages", workload.draftMessages],
          ["Mission Control", workload.missionControlAlerts],
          ["Pending attendance", workload.pendingAttendanceSessions],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          </article>
        ))}
      </div>
    );
  }

  if (view === "progress") {
    return (
      <div className="space-y-6">
        <ProgressRecordForm students={rosterStudents} />
        <div className="grid gap-4 lg:grid-cols-2">
          <ProgressChart records={progressByDomain.reading ?? []} title="Reading progress" />
          <ProgressChart records={progressByDomain.writing ?? []} title="Writing progress" />
          <ProgressChart records={progressByDomain.math ?? []} title="Mathematics progress" />
          <ProgressChart records={progressByDomain.structured_literacy ?? []} title="Structured Literacy" />
        </div>
      </div>
    );
  }

  if (view === "lessons") {
    return (
      <div className="space-y-6">
        <LessonPlanForm />
        <div className="space-y-3">
          {lessonPlans.map((lp) => (
            <article key={lp.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-medium text-slate-900">{lp.title}</h3>
              <p className="text-sm capitalize text-slate-500">{lp.subject_domain?.replace(/_/g, " ") ?? "General"} · {lp.status}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (view === "notes") {
    return (
      <div className="space-y-6">
        <TeacherNoteForm students={rosterStudents} />
        <div className="space-y-3">
          {notes.map((n) => (
            <article key={n.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{n.category}</span>
                {n.tags.map((t) => (
                  <span key={t} className="text-xs text-brand-600">#{t}</span>
                ))}
              </div>
              <h3 className="mt-2 font-medium text-slate-900">{n.title}</h3>
              <p className="mt-1 text-sm text-slate-600 line-clamp-3">{n.body}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (view === "interventions") {
    return (
      <div className="space-y-6">
        <InterventionForm students={rosterStudents} />
        <div className="space-y-3">
          {interventions.map((iv) => (
            <article key={iv.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-medium text-slate-900">{iv.intervention_type}</h3>
              <p className="text-sm text-slate-600">{iv.goal_text ?? "—"}</p>
              {iv.review_date && <p className="mt-1 text-xs text-slate-400">Review: {iv.review_date}</p>}
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (view === "parent-comm") {
    return (
      <div className="space-y-6">
        <ParentMessageForm students={rosterStudents} />
        <div className="space-y-3">
          {outreach.map((o) => (
            <article key={o.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-900">{o.subject}</h3>
                <span className="text-xs capitalize text-slate-500">{o.status}</span>
              </div>
              <p className="text-sm capitalize text-slate-500">{o.message_type.replace(/_/g, " ")}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (view === "artifacts") {
    return (
      <div className="space-y-6">
        <ArtifactForm students={rosterStudents} />
        <Suspense fallback={null}>
          <EvidenceLibraryFilters basePath={evidenceFilterBasePath} />
        </Suspense>
        <div className="grid gap-3 sm:grid-cols-2">
          {evidenceLibrary.map((a) => (
            <article key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-medium">{a.title}</h3>
              <p className="text-sm capitalize text-slate-500">{a.artifact_type.replace(/_/g, " ")}</p>
              <p className="text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString()}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (view === "collaboration") {
    return (
      <div className="space-y-3">
        {rosterStudents.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/teacher/students/${s.id}`}
            className="block rounded-xl border border-brand-200 bg-brand-50/50 p-4 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            Open growth plan — {s.first_name} {s.last_name}
          </Link>
        ))}
        {collaborationFeed.map((ev) => {
          const st = Array.isArray(ev.students) ? ev.students[0] : ev.students;
          return (
            <article key={ev.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-400">{new Date(ev.occurred_at).toLocaleString()}</p>
              <h3 className="font-medium text-slate-900">{ev.title}</h3>
              {(st as { first_name?: string })?.first_name && (
                <p className="text-sm text-slate-500">{(st as { first_name?: string }).first_name} {(st as { last_name?: string }).last_name}</p>
              )}
              {ev.body && <p className="mt-1 text-sm text-slate-600">{ev.body}</p>}
            </article>
          );
        })}
        {!collaborationFeed.length && <p className="text-sm text-slate-500">No team activity yet.</p>}
      </div>
    );
  }

  if (view === "quality") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Sessions completed", qualityMetrics.sessionsCompleted],
            ["Documentation rate", `${qualityMetrics.documentationRate}%`],
            ["Attendance completion", `${qualityMetrics.attendanceCompletionRate}%`],
            ["Goal updates", qualityMetrics.goalUpdates],
            ["Avg goal progress", `${qualityMetrics.avgGoalProgress}%`],
            ["Compliance score", `${qualityMetrics.complianceScore}%`],
            ["Parent messages", qualityMetrics.parentMessagesSent],
            ["Parent response rate", `${qualityMetrics.parentResponseRate ?? 0}%`],
            ["Active interventions", qualityMetrics.activeInterventions],
            ["Interventions completed", qualityMetrics.interventionsCompleted ?? 0],
          ].map(([label, value]) => (
            <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
            </article>
          ))}
        </div>
        {schoolQuality && (
          <section className="rounded-2xl border border-brand-200 bg-brand-50/30 p-6">
            <h3 className="font-semibold text-slate-900">School-wide instructional quality</h3>
            <p className="mt-1 text-sm text-slate-600">{schoolQuality.staffCount} instructional staff tracked</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div><span className="text-slate-500">Avg documentation</span><p className="text-xl font-semibold">{schoolQuality.avgDocumentationRate}%</p></div>
              <div><span className="text-slate-500">Avg attendance</span><p className="text-xl font-semibold">{schoolQuality.avgAttendanceCompletion}%</p></div>
              <div><span className="text-slate-500">Avg goal progress</span><p className="text-xl font-semibold">{schoolQuality.avgGoalProgress}%</p></div>
              <div><span className="text-slate-500">Sessions completed</span><p className="text-xl font-semibold">{schoolQuality.totalSessionsCompleted}</p></div>
            </div>
          </section>
        )}
      </div>
    );
  }

  if (view === "compliance") {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Documentation Deadlines</h3>
        {compliance.map((item, i) => (
          <article key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.severity === "high" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                {item.severity}
              </span>
              <p className="mt-2 font-medium text-slate-900">{item.title}</p>
            </div>
            {item.href && (
              <Link href={item.href} className="text-sm text-brand-600 hover:underline">
                Resolve
              </Link>
            )}
          </article>
        ))}
        {!compliance.length && (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-sm text-emerald-800">
            All compliance items are current.
          </p>
        )}
      </div>
    );
  }

  if (view === "ai-readiness") {
    const caps = aiConfig?.capabilities ?? {};
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">AI Readiness Architecture</h3>
        <p className="mt-2 text-sm text-slate-600">
          Future AI capabilities are architected but not enabled. No AI processing occurs in this release.
        </p>
        <ul className="mt-4 space-y-2">
          {Object.entries(caps).map(([key, enabled]) => (
            <li key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="capitalize text-slate-700">{key.replace(/_/g, " ")}</span>
              <span className={`font-medium ${enabled ? "text-emerald-600" : "text-slate-400"}`}>
                {enabled ? "Enabled" : "Not enabled"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return <TeacherMyDay sessions={sessions} />;
}
