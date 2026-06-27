import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getStudentSelfId } from "@/lib/platform/identity/portal-access";

export default async function StudentGoalsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/student/goals");

  const supabase = await createAuthClient();
  const studentId = await getStudentSelfId(supabase, sessionUser.id);
  if (!studentId) redirect("/portal");

  const { data: goals } = await supabase
    .from("student_growth_goals")
    .select("*")
    .eq("student_id", studentId)
    .in("status", ["active", "on_track", "at_risk"])
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Goals</h1>
      <ul className="space-y-3">
        {(goals ?? []).map((g) => (
          <li key={g.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-semibold">{g.title}</p>
            {g.description && <p className="mt-1 text-sm text-slate-600">{g.description}</p>}
            <p className="mt-2 text-sm text-brand-700">{Number(g.progress_pct)}% progress</p>
          </li>
        ))}
        {!goals?.length && <li className="text-slate-500">No active goals right now.</li>}
      </ul>
    </div>
  );
}
