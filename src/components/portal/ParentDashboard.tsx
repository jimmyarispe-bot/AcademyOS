import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { PortalStudentSummary } from "@/lib/portal/dashboard";
import type { DeadlineBucket } from "@/lib/compliance/types";
import { MyDeadlinesWidget } from "@/components/portal/MyDeadlinesWidget";

interface ParentDashboardProps {
  students: PortalStudentSummary[];
  financial: { combinedBalance: number; combinedCredits: number };
  tasks: {
    id: string;
    title: string;
    dueDate?: string;
    category: string;
    href?: string;
    studentId?: string;
    actionType?: string;
    parentCanComplete?: boolean;
  }[];
  deadlines: DeadlineBucket;
  unreadNotifications: number;
}

function scoreColor(status?: string | null) {
  if (status === "green") return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (status === "yellow") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

export function ParentDashboard({ students, financial, tasks, deadlines, unreadNotifications }: ParentDashboardProps) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Children</p>
          <p className="text-3xl font-semibold">{students.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Outstanding balance</p>
          <p className="text-2xl font-semibold text-amber-700">{formatCurrency(financial.combinedBalance)}</p>
          <Link href="/portal/finance" className="text-xs text-brand-600 hover:underline">View finance →</Link>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Open tasks</p>
          <p className="text-3xl font-semibold">{tasks.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Notifications</p>
          <p className="text-3xl font-semibold">{unreadNotifications}</p>
          <Link href="/portal/notifications" className="text-xs text-brand-600 hover:underline">View all →</Link>
        </article>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Your students</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/portal/students/${s.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-200 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{s.first_name} {s.last_name}</h3>
                  <p className="text-sm capitalize text-slate-500">{s.program?.replace(/_/g, " ") ?? "Student"} · Grade {s.grade_level ?? "—"}</p>
                </div>
                {s.successScore && (
                  <span className={`rounded-full border px-3 py-1 text-sm font-medium ${scoreColor(s.successScore.statusIndicator)}`}>
                    {s.successScore.overallScore}
                  </span>
                )}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
                <li>Today: {s.todaySessions} session{s.todaySessions !== 1 ? "s" : ""}</li>
                <li>{s.upcomingMeetings} upcoming meeting{s.upcomingMeetings !== 1 ? "s" : ""}</li>
                {s.attendanceAlert && <li className="text-amber-700">Attendance alert today</li>}
                {s.medicalAlerts > 0 && <li className="text-rose-700">{s.medicalAlerts} medical alert{s.medicalAlerts !== 1 ? "s" : ""}</li>}
                {s.documentsNeeded > 0 && <li>{s.documentsNeeded} document{s.documentsNeeded !== 1 ? "s" : ""} need attention</li>}
              </ul>
            </Link>
          ))}
          {!students.length && (
            <p className="col-span-full rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              No enrolled students linked to your account. Contact the registrar to connect your guardian profile.
            </p>
          )}
        </div>
      </section>

      <MyDeadlinesWidget
        deadlines={deadlines}
        tasks={tasks}
        students={students.map((s) => ({ id: s.id, first_name: s.first_name, last_name: s.last_name }))}
      />
    </div>
  );
}
