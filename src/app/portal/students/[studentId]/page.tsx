import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { assertParentStudentAccess } from "@/lib/platform/identity/portal-access";
import { getStudentPortalDetail } from "@/lib/portal/dashboard";

export default async function PortalStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal");

  const supabase = await createAuthClient();
  if (!(await assertParentStudentAccess(supabase, sessionUser.id, studentId))) notFound();

  const detail = await getStudentPortalDetail(supabase, studentId, sessionUser.id);
  if (!detail) notFound();

  const { student, score, schedule, meetings, interventions, behavior, funding, scholarships } = detail;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/portal" className="text-sm text-brand-600 hover:underline">← All students</Link>
        <h1 className="mt-2 text-3xl font-bold">{student.first_name} {student.last_name}</h1>
        <p className="text-slate-600 capitalize">{student.program?.replace(/_/g, " ") ?? "Student"}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Success score</p>
          <p className="text-2xl font-semibold">{score?.overallScore ?? "—"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Upcoming classes</p>
          <p className="text-2xl font-semibold">{schedule.sessions?.length ?? 0}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Active interventions</p>
          <p className="text-2xl font-semibold">{interventions.length}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Meetings</p>
          <p className="text-2xl font-semibold">{meetings.length}</p>
        </article>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={`/portal/progress?student=${studentId}`} className="rounded-lg bg-brand-50 px-4 py-2 text-brand-700">Progress</Link>
        <Link href={`/portal/documents?student=${studentId}`} className="rounded-lg bg-brand-50 px-4 py-2 text-brand-700">Documents</Link>
        <Link href={`/portal/portfolio?student=${studentId}`} className="rounded-lg bg-brand-50 px-4 py-2 text-brand-700">Portfolio</Link>
        <Link href="/portal/conferences" className="rounded-lg bg-brand-50 px-4 py-2 text-brand-700">Conferences</Link>
      </div>

      {behavior.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Recent behavior updates</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {behavior.map((b) => (
              <li key={b.id} className="rounded-lg bg-slate-50 px-3 py-2 capitalize">
                {b.event_type?.replace(/_/g, " ")} — {new Date(b.occurred_at).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(funding.length > 0 || scholarships.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {scholarships.length > 0 && (
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
              <h2 className="font-semibold">Scholarships</h2>
              {scholarships.map((s) => (
                <p key={s.id} className="mt-2 text-sm">${Number(s.approved_amount ?? 0).toLocaleString()} approved</p>
              ))}
            </article>
          )}
          {funding.length > 0 && (
            <article className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
              <h2 className="font-semibold">State funding</h2>
              {funding.map((f) => (
                <p key={f.id} className="mt-2 text-sm capitalize">{f.funding_category.replace(/_/g, " ")} — {f.verification_status}</p>
              ))}
            </article>
          )}
        </section>
      )}
    </div>
  );
}
