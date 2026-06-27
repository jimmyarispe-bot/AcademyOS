import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getParentLinkedStudentIds } from "@/lib/platform/identity/portal-access";
import { getFamilyEngagementDashboard } from "@/lib/portal/engagement";

export default async function PortalEngagementPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/engagement");

  const supabase = await createAuthClient();
  const studentIds = await getParentLinkedStudentIds(supabase, sessionUser.id);
  const engagement = await getFamilyEngagementDashboard(supabase, studentIds);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Family Engagement</h1>
      <p className="text-slate-600">Portal usage, conference participation, form completion, and suggestions.</p>

      <article className="rounded-2xl border border-brand-200 bg-brand-50/40 p-6">
        <p className="text-sm text-slate-500">Overall engagement score</p>
        <p className="text-4xl font-bold text-brand-800">{engagement.overallScore}</p>
      </article>

      {engagement.summaries.map(({ student, engagementScore, portalLogins, messages, conferencesAttended, formsCompleted, suggestions }) => (
        <section key={student.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">{student.first_name} {student.last_name}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div><p className="text-slate-500">Score</p><p className="font-semibold">{engagementScore}</p></div>
            <div><p className="text-slate-500">Portal logins</p><p className="font-semibold">{portalLogins}</p></div>
            <div><p className="text-slate-500">Messages</p><p className="font-semibold">{messages}</p></div>
            <div><p className="text-slate-500">Conferences</p><p className="font-semibold">{conferencesAttended}</p></div>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {suggestions.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
