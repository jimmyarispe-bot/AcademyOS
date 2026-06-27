import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { assertParentStudentAccess, getParentLinkedStudentIds } from "@/lib/platform/identity/portal-access";
import { getStudentProgressCenter } from "@/lib/portal/progress";

export default async function PortalProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/progress");

  const { student: studentParam } = await searchParams;
  const supabase = await createAuthClient();
  const studentIds = await getParentLinkedStudentIds(supabase, sessionUser.id);
  const studentId = studentParam && studentIds.includes(studentParam) ? studentParam : studentIds[0];
  if (!studentId) notFound();
  if (!(await assertParentStudentAccess(supabase, sessionUser.id, studentId))) notFound();

  const progress = await getStudentProgressCenter(supabase, studentId);
  const { data: student } = await supabase.from("students").select("first_name, last_name").eq("id", studentId).single();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Progress Center</h1>
      <p className="text-slate-600">{student?.first_name} {student?.last_name} — reading, math, interventions, goals, and teacher feedback.</p>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Growth goals</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {progress.goals.map((g) => (
            <li key={g.id} className="rounded-lg bg-slate-50 px-3 py-2">
              {g.title} — <span className="capitalize">{g.status}</span>
            </li>
          ))}
          {!progress.goals.length && <li className="text-slate-500">No active goals.</li>}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Interventions</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {progress.interventions.filter((i) => i.status === "active").map((i) => (
            <li key={i.id} className="rounded-lg bg-amber-50 px-3 py-2">{i.intervention_type ?? i.title} — {i.status}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Assessments & benchmarks</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {progress.assessments.slice(0, 10).map((a) => (
            <li key={a.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{a.assessment_type ?? a.subject_domain}</span>
              <span>{a.score != null ? a.score : "—"} · {a.assessed_on}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Teacher observations</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {progress.observations.slice(0, 8).map((o) => (
            <li key={o.id} className="rounded-lg bg-slate-50 px-3 py-2">{o.observation_text} <span className="text-slate-400">({o.domain})</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
