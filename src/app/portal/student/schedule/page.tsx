import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getStudentSelfId } from "@/lib/platform/identity/portal-access";
import { getStudentSchedule } from "@/lib/scheduling/queries";

export default async function StudentSchedulePage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/student/schedule");

  const supabase = await createAuthClient();
  const studentId = await getStudentSelfId(supabase, sessionUser.id);
  if (!studentId) redirect("/portal");

  const schedule = await getStudentSchedule(studentId);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Schedule</h1>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Classes</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(schedule.sessions ?? []).map((s) => {
            const cs = Array.isArray(s.course_sections) ? s.course_sections[0] : s.course_sections;
            const c = cs?.courses;
            const name = Array.isArray(c) ? c[0]?.name : c?.name;
            return (
              <li key={s.id} className="rounded-lg bg-slate-50 px-3 py-2">
                {name ?? "Class"} — {new Date(s.scheduled_start).toLocaleString()}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Therapy & services</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(schedule.services ?? []).map((s) => (
            <li key={s.id} className="rounded-lg bg-sky-50 px-3 py-2 capitalize">
              {s.service_type} — {new Date(s.scheduled_at).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
