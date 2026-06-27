import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getStudentSelfId, canAccessStudentPortal } from "@/lib/platform/identity/portal-access";
import { getStudentSelfDashboard } from "@/lib/portal/student-dashboard";
import { getStudentDeadlines } from "@/lib/compliance/deadlines";
import { StudentAssignmentsDeadlinesWidget } from "@/components/portal/StudentAssignmentsDeadlinesWidget";

export default async function StudentPortalHomePage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/student");

  const supabase = await createAuthClient();
  const [canStudent, studentId] = await Promise.all([
    canAccessStudentPortal(supabase, sessionUser.id),
    getStudentSelfId(supabase, sessionUser.id),
  ]);

  if (!canStudent || !studentId) {
    redirect("/portal");
  }

  const data = await getStudentSelfDashboard(supabase, studentId);
  if (!data.student) redirect("/portal");

  const deadlines = await getStudentDeadlines(supabase, studentId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Hi, {data.student.first_name}!</h1>
        <p className="text-slate-600">Your schedule, goals, and progress for today.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Success score</p>
          <p className="text-2xl font-semibold">{data.score?.overallScore ?? "—"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Attendance (30d)</p>
          <p className="text-2xl font-semibold">{data.attendanceRate != null ? `${data.attendanceRate}%` : "—"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Active goals</p>
          <p className="text-2xl font-semibold">{data.goals.length}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Today&apos;s schedule</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.todaySchedule.sessions.map((s) => (
            <li key={s.id as string} className="rounded-lg bg-slate-50 px-3 py-2">
              Class · {new Date((s as { scheduled_start: string }).scheduled_start).toLocaleTimeString()}
            </li>
          ))}
          {data.todaySchedule.services.map((s) => (
            <li key={s.id as string} className="rounded-lg bg-sky-50 px-3 py-2 capitalize">
              {(s as { service_type?: string }).service_type ?? "Service"} · {new Date((s as { scheduled_at: string }).scheduled_at).toLocaleTimeString()}
            </li>
          ))}
          {!data.todaySchedule.sessions.length && !data.todaySchedule.services.length && (
            <li className="text-slate-500">No sessions scheduled today.</li>
          )}
        </ul>
      </section>

      <StudentAssignmentsDeadlinesWidget
        dueToday={deadlines.today}
        dueTomorrow={deadlines.dueTomorrow}
        upcoming={deadlines.upcoming ?? [...deadlines.thisWeek, ...deadlines.next30Days]}
        overdue={deadlines.overdue}
        completed={deadlines.completed ?? []}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">My goals</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.goals.map((g) => (
            <li key={g.id} className="rounded-lg bg-emerald-50 px-3 py-2">{g.title}{g.description ? ` — ${g.description}` : ""}</li>
          ))}
        </ul>
      </section>

      <div className="flex gap-3 text-sm">
        <Link href="/portal/student/schedule" className="text-brand-600 hover:underline">Full schedule →</Link>
        <Link href="/portal/messages" className="text-brand-600 hover:underline">Messages →</Link>
      </div>
    </div>
  );
}
