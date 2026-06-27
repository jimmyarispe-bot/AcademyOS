import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getParentDashboardData, getLinkedStudentsForPortal } from "@/lib/portal/dashboard";
import { ParentDashboard } from "@/components/portal/ParentDashboard";
import { recordPortalLoginAction } from "@/lib/portal/actions";

export const metadata = { title: "Family Portal | AcademyOS" };

export default async function PortalHomePage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal");

  const supabase = await createAuthClient();
  const students = await getLinkedStudentsForPortal(supabase, sessionUser.id);

  if (!students.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Welcome to AcademyOS</h1>
        <p className="mt-2 text-slate-600">
          Your enrolled students are not linked yet. Continue admissions or contact the registrar.
        </p>
        <a href="/apply/portal" className="mt-4 inline-block text-brand-600 hover:underline">Go to admissions portal →</a>
      </div>
    );
  }

  await recordPortalLoginAction(students.map((s) => s.id));
  const dashboard = await getParentDashboardData(supabase, sessionUser.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Family Dashboard</h1>
        <p className="mt-1 text-slate-600">Everything you need for your children — schedules, progress, finance, and more.</p>
      </div>
      <ParentDashboard
        students={dashboard.students}
        financial={dashboard.financial}
        tasks={dashboard.tasks}
        deadlines={dashboard.deadlines}
        unreadNotifications={dashboard.unreadNotifications}
      />
    </div>
  );
}
