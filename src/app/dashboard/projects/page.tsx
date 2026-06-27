import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectsList } from "@/components/work/WorkLists";
import { createProjectAction } from "@/lib/work/actions";
import { canManageWork, canViewWork } from "@/lib/work/access";
import { getProjects } from "@/lib/work/queries";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { redirect } from "next/navigation";
import { getSchools } from "@/lib/hr/queries";

export default async function ProjectsPage() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewWork(ctx)) redirect("/dashboard");

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    undefined;

  const supabase = await createAuthClient();
  const [projects, schools] = await Promise.all([
    getProjects(supabase, { schoolId, limit: 100 }),
    getSchools(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Projects" subtitle="Enterprise projects across admissions, HR, finance, compliance, and operations" />

      {canManageWork(ctx) && (
        <form action={createProjectAction} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">New project</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input name="name" required placeholder="Project name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select name="project_type" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="custom">Custom</option>
              <option value="admissions">Admissions</option>
              <option value="enrollment">Enrollment</option>
              <option value="hiring">Hiring</option>
              <option value="compliance">Compliance</option>
              <option value="grant">Grant</option>
              <option value="strategic_plan">Strategic Plan</option>
            </select>
            <select name="school_id" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input name="target_date" type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create project
          </button>
        </form>
      )}

      <ProjectsList projects={projects} />
    </div>
  );
}
