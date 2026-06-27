import { formatAcademyTime } from "@/lib/scheduling/academy-way";
import { GenerateSessionsButton } from "@/components/scheduling/GenerateSessionsButton";
import { ResolveConflictButton } from "@/components/scheduling/SchedulingActions";

type SectionRow = {
  id: string;
  section_code: string;
  delivery_mode?: string;
  max_capacity?: number;
  status?: string;
  courses?: { name?: string; code?: string; academy_subject?: string } | { name?: string; code?: string; academy_subject?: string }[] | null;
  school_years?: { name?: string } | { name?: string }[] | null;
  campuses?: { name?: string } | { name?: string }[] | null;
};

type SessionRow = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  time_display?: string | null;
  meet_link?: string | null;
  session_type?: string;
  course_sections?: {
    section_code?: string;
    courses?: { name?: string } | { name?: string }[] | null;
  } | {
    section_code?: string;
    courses?: { name?: string } | { name?: string }[] | null;
  }[] | null;
};

type RoomRow = {
  id: string;
  name: string;
  room_type: string;
  capacity: number;
  is_virtual: boolean;
  meet_link?: string | null;
};

type ConflictRow = {
  id: string;
  conflict_type: string;
  severity: string;
  title: string;
  description?: string | null;
  recommendation?: string | null;
  detected_at: string;
};

type CalendarEventRow = {
  id: string;
  title: string;
  event_type: string;
  starts_at: string;
  ends_at: string;
  academic_calendars?: { name?: string; calendar_scope?: string } | { name?: string; calendar_scope?: string }[] | null;
};

type WorkloadRow = {
  employeeId: string;
  name: string;
  sessionCount: number;
  weeklyHours: number;
  overloaded: boolean;
};

type Recommendation = {
  priority: string;
  category: string;
  title: string;
  detail: string;
  action?: string;
};

interface SchedulingTabsProps {
  view: string;
  sections: SectionRow[];
  sessions: SessionRow[];
  rooms: RoomRow[];
  conflicts: ConflictRow[];
  calendarEvents: CalendarEventRow[];
  workload: WorkloadRow[];
  recommendations: Recommendation[];
}

function rel(obj: unknown): Record<string, unknown> | null {
  if (!obj) return null;
  return (Array.isArray(obj) ? obj[0] : obj) as Record<string, unknown>;
}

export function SchedulingTabs({
  view,
  sections,
  sessions,
  rooms,
  conflicts,
  calendarEvents,
  workload,
  recommendations,
}: SchedulingTabsProps) {
  if (view === "sections") {
    return (
      <div className="space-y-4">
        {sections.map((section) => {
          const course = rel(section.courses);
          return (
            <article key={section.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{section.section_code}</h3>
                  <p className="text-sm text-slate-500">
                    {(course?.name as string) ?? "Course"} · {section.delivery_mode} · cap {section.max_capacity}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {section.status}
                </span>
              </div>
              <div className="mt-4">
                <GenerateSessionsButton sectionId={section.id} sectionCode={section.section_code} />
              </div>
            </article>
          );
        })}
        {!sections.length && (
          <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            No course sections yet. Create courses and sections to begin scheduling.
          </p>
        )}
      </div>
    );
  }

  if (view === "sessions") {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Meet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessions.map((s) => {
              const cs = rel(s.course_sections);
              const course = rel(cs?.courses);
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-slate-900">
                    {s.time_display ??
                      `${formatAcademyTime(s.scheduled_start)} – ${formatAcademyTime(s.scheduled_end)}`}
                    <div className="text-xs text-slate-400">
                      {new Date(s.scheduled_start).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(cs?.section_code as string) ?? "—"}
                    <div className="text-xs text-slate-400">{(course?.name as string) ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{s.session_type?.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    {s.meet_link ? (
                      <a href={s.meet_link} className="text-brand-600 hover:underline" target="_blank" rel="noreferrer">
                        Join
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!sessions.length && (
          <p className="p-8 text-center text-sm text-slate-500">No upcoming sessions scheduled.</p>
        )}
      </div>
    );
  }

  if (view === "rooms") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <article key={room.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">{room.name}</h3>
            <p className="mt-1 text-sm capitalize text-slate-500">
              {room.room_type.replace(/_/g, " ")} · {room.capacity} seats
              {room.is_virtual ? " · Virtual" : ""}
            </p>
            {room.meet_link && (
              <a href={room.meet_link} className="mt-2 inline-block text-sm text-brand-600 hover:underline" target="_blank" rel="noreferrer">
                Room Meet link
              </a>
            )}
          </article>
        ))}
        {!rooms.length && (
          <p className="col-span-full rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            No rooms configured.
          </p>
        )}
      </div>
    );
  }

  if (view === "calendar") {
    return (
      <div className="space-y-3">
        {calendarEvents.map((ev) => {
          const cal = rel(ev.academic_calendars);
          return (
            <article key={ev.id} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="min-w-[4.5rem] text-center">
                <div className="text-lg font-semibold text-slate-900">
                  {new Date(ev.starts_at).getDate()}
                </div>
                <div className="text-xs uppercase text-slate-500">
                  {new Date(ev.starts_at).toLocaleDateString("en-US", { month: "short" })}
                </div>
              </div>
              <div>
                <h3 className="font-medium text-slate-900">{ev.title}</h3>
                <p className="text-sm capitalize text-slate-500">
                  {ev.event_type.replace(/_/g, " ")} · {(cal?.calendar_scope as string) ?? "school"}
                </p>
              </div>
            </article>
          );
        })}
        {!calendarEvents.length && (
          <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            No calendar events in the next 90 days.
          </p>
        )}
      </div>
    );
  }

  if (view === "workload") {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Sessions</th>
              <th className="px-4 py-3">Weekly hours</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workload.map((w) => (
              <tr key={w.employeeId}>
                <td className="px-4 py-3 font-medium text-slate-900">{w.name}</td>
                <td className="px-4 py-3">{w.sessionCount}</td>
                <td className="px-4 py-3">{w.weeklyHours}h</td>
                <td className="px-4 py-3">
                  {w.overloaded ? (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                      Overloaded
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (view === "intelligence") {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Active conflicts</h3>
          <div className="space-y-3">
            {conflicts.map((c) => (
              <article key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.severity === "critical"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {c.severity}
                    </span>
                    <h4 className="mt-2 font-medium text-slate-900">{c.title}</h4>
                    <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                    {c.recommendation && (
                      <p className="mt-2 text-xs text-brand-600">{c.recommendation}</p>
                    )}
                  </div>
                  <ResolveConflictButton conflictId={c.id} />
                </div>
              </article>
            ))}
            {!conflicts.length && (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No unresolved conflicts.
              </p>
            )}
          </div>
        </section>
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map((r, i) => (
              <article key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="text-xs font-medium uppercase text-slate-400">{r.category}</span>
                <h4 className="mt-1 font-medium text-slate-900">{r.title}</h4>
                <p className="mt-1 text-sm text-slate-600">{r.detail}</p>
                {r.action && <p className="mt-2 text-xs text-brand-600">{r.action}</p>}
              </article>
            ))}
            {!recommendations.length && (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Run a conflict scan to generate recommendations.
              </p>
            )}
          </div>
        </section>
      </div>
    );
  }

  // executive default
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">Academy Way rules</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>Virtual classes start on the hour, end at :50</li>
          <li>Reading / Writing / Math minimum size: 4</li>
          <li>Structured Literacy minimum size: 2</li>
          <li>Tutoring is always 1:1</li>
          <li>One teacher per instructional session</li>
          <li>12-hour time display (no military time)</li>
        </ul>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">Integrations</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>Session attendance syncs to SSIS automatically</li>
          <li>Google Meet links from teacher profiles</li>
          <li>Mission Control alerts for critical conflicts</li>
          <li>Automation Engine queue processing</li>
          <li>Parent notifications on absence</li>
        </ul>
      </article>
    </div>
  );
}
