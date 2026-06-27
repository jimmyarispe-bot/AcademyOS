import { PageHeader } from "@/components/ui/PageHeader";
import { WorkExecutivePanel } from "@/components/work/WorkLists";
import { canViewWorkReports } from "@/lib/work/access";
import {
  getProjectSummaryReport,
  getTaskSummaryReport,
  getPlaybookPerformanceReport,
  buildCsvExport,
} from "@/lib/work/queries";
import { getWorkExecutiveMetrics } from "@/lib/work/executive";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function WorkReportsPage() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewWorkReports(ctx)) redirect("/dashboard/work");

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    undefined;

  const supabase = await createAuthClient();
  const [projectReport, taskReport, playbookReport, executive] = await Promise.all([
    getProjectSummaryReport(supabase, schoolId),
    getTaskSummaryReport(supabase, schoolId),
    getPlaybookPerformanceReport(supabase),
    getWorkExecutiveMetrics(supabase, schoolId),
  ]);

  const csvPreview = buildCsvExport(projectReport.slice(0, 50) as Record<string, unknown>[], [
    "school_name",
    "project_type",
    "status",
    "project_count",
    "avg_completion_pct",
    "delayed_count",
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Work Reports" subtitle="Project, task, workload, and playbook performance reporting" />
        <Link
          href={`/api/work/reports?type=projects${schoolId ? `&school_id=${schoolId}` : ""}`}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Export CSV
        </Link>
      </div>

      <WorkExecutivePanel metrics={executive} />

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Project summary</h2>
          <p className="mt-1 text-sm text-slate-500">{projectReport.length} aggregated rows</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Task summary</h2>
          <p className="mt-1 text-sm text-slate-500">{taskReport.length} status groups</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="font-semibold">Playbook performance</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {playbookReport.map((pb) => (
              <li key={pb.name} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{pb.name}</span>
                <span className="text-slate-500">{pb.completed}/{pb.runs} completed</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">CSV preview (architecture for PDF export later)</h2>
        <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{csvPreview.split("\n").slice(0, 6).join("\n")}</pre>
      </section>
    </div>
  );
}
