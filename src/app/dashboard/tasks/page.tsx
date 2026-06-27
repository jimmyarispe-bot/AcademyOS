import { PageHeader } from "@/components/ui/PageHeader";
import { TasksList } from "@/components/work/WorkLists";
import { createTaskAction } from "@/lib/work/actions";
import { canManageWork, canViewWork } from "@/lib/work/access";
import { getTasks, getProjects } from "@/lib/work/queries";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { redirect } from "next/navigation";

export default async function TasksPage() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewWork(ctx)) redirect("/dashboard");

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    undefined;

  const supabase = await createAuthClient();
  const [tasks, projects] = await Promise.all([
    getTasks(supabase, { schoolId, limit: 200 }),
    getProjects(supabase, { schoolId, status: "active", limit: 50 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Tasks" subtitle="All operational tasks across projects and playbooks" />

      {canManageWork(ctx) && (
        <form action={createTaskAction} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">New task</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input name="title" required placeholder="Task title" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select name="project_id" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input name="due_date" type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select name="priority" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            {schoolId && <input type="hidden" name="school_id" value={schoolId} />}
          </div>
          <button type="submit" className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create task
          </button>
        </form>
      )}

      <TasksList tasks={tasks} />
    </div>
  );
}
