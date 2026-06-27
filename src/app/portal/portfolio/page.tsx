import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getParentLinkedStudentIds } from "@/lib/platform/identity/portal-access";
import { getStudentPortfolio } from "@/lib/portal/portfolio";

export default async function PortalPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; view?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/portfolio");

  const { student: studentParam, view: viewParam } = await searchParams;
  const supabase = await createAuthClient();
  const studentIds = await getParentLinkedStudentIds(supabase, sessionUser.id);
  const studentId = studentParam && studentIds.includes(studentParam) ? studentParam : studentIds[0];
  if (!studentId) notFound();

  const view = viewParam === "subject" ? "subject" : "chronological";
  const portfolio = await getStudentPortfolio(supabase, studentId, view);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Student Portfolio</h1>
          <p className="text-slate-600">Writing samples, projects, assessments, and teacher feedback.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/portal/portfolio?student=${studentId}&view=chronological`} className={`rounded-lg px-3 py-1.5 ${view === "chronological" ? "bg-brand-100 text-brand-800" : "bg-slate-100"}`}>Chronological</Link>
          <Link href={`/portal/portfolio?student=${studentId}&view=subject`} className={`rounded-lg px-3 py-1.5 ${view === "subject" ? "bg-brand-100 text-brand-800" : "bg-slate-100"}`}>By subject</Link>
        </div>
      </div>

      {view === "subject" && portfolio.bySubject ? (
        Object.entries(portfolio.bySubject).map(([subject, items]) => (
          <section key={subject} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold capitalize">{subject.replace(/_/g, " ")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((a) => (
                <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-medium">{a.title}</p>
                  {a.description && <p className="text-slate-600">{a.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <ul className="space-y-2">
          {portfolio.artifacts.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <p className="font-medium">{a.title}</p>
              <p className="text-slate-500 capitalize">{a.artifact_type?.replace(/_/g, " ")} · {new Date(a.created_at).toLocaleDateString()}</p>
              {a.description && <p className="mt-1 text-slate-600">{a.description}</p>}
            </li>
          ))}
          {!portfolio.artifacts.length && <li className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No portfolio items yet.</li>}
        </ul>
      )}
    </div>
  );
}
