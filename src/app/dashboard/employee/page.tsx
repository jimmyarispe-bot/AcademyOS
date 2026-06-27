import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { canAccessEmployeePortal } from "@/lib/hr/access";
import { getEmployeeSelfServiceDashboard } from "@/lib/hr/employee-portal";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { EmployeePortalDashboard } from "@/components/hr/EmployeePortalDashboard";

export default async function EmployeePortalPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/dashboard/employee");

  const ctx = await getIdentityContext();
  if (!ctx || !canAccessEmployeePortal(ctx)) redirect("/dashboard");

  const supabase = await createAuthClient();
  const data = await getEmployeeSelfServiceDashboard(supabase, sessionUser.id);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-slate-200 p-10 text-center">
        <h1 className="text-xl font-bold">Employee Portal</h1>
        <p className="mt-2 text-slate-600">No employee record linked to your account. Contact HR to connect your profile.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <EmployeePortalDashboard data={data} />
    </div>
  );
}
