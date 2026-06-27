import { PageHeader } from "@/components/ui/PageHeader";
import { MyWorkPanel } from "@/components/work/WorkPanels";
import { canViewWork } from "@/lib/work/access";
import { getMyWorkSummary, getUserWorkload, getDepartmentWorkload } from "@/lib/work/queries";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { redirect } from "next/navigation";

export default async function WorkloadPage() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewWork(ctx)) redirect("/dashboard");

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    undefined;

  const supabase = await createAuthClient();
  const userId = ctx.effectiveUserId;
  const department = "operations";

  const [summary, workload, deptWorkload] = await Promise.all([
    getMyWorkSummary(supabase, userId, schoolId),
    getUserWorkload(supabase, userId, schoolId),
    getDepartmentWorkload(supabase, department, schoolId),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Workload" subtitle="Today's tasks, this week, upcoming, overdue, waiting, and approvals" />
      <MyWorkPanel summary={summary} workload={workload} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Department workload</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {Object.entries(deptWorkload).map(([userId, stats]) => (
            <li key={userId} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{userId === "unassigned" ? "Unassigned" : userId.slice(0, 8)}</span>
              <span className="text-slate-500">{stats.count} tasks · {stats.hours}h est · {stats.overdue} overdue</span>
            </li>
          ))}
          {!Object.keys(deptWorkload).length && (
            <li className="text-slate-500">No department tasks in queue.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
