import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { getJobs } from "@/lib/intelligence-platform/queue-engine";
import { AipShell } from "@/components/intelligence-platform/AipNav";
import { HistoryTable } from "@/components/intelligence-platform/AipPanels";
import { queueJobAction, cancelJobAction } from "@/lib/intelligence-platform/actions";

export default async function JobsPage() {
  await requirePagePermission(["ai.view", "ai.manage", "ai.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const jobs = orgId ? await getJobs(supabase, orgId) : [];

  return (
    <AipShell title="AI Queue Engine" subtitle="Retry, priority, cancellation, scheduling, and dependency support">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={queueJobAction} className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            Module
            <input name="module" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" defaultValue="general" />
          </label>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Queue test job
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Job queue</h2>
        <HistoryTable
          rows={jobs}
          columns={[
            { key: "module", label: "Module" },
            { key: "job_type", label: "Type" },
            { key: "status", label: "Status" },
            { key: "priority", label: "Priority" },
            { key: "retry_count", label: "Retries" },
          ]}
        />
        {jobs.filter((j) => j.status === "queued" || j.status === "running").map((j) => (
          <form key={j.id} action={cancelJobAction} className="mt-2 inline-block mr-2">
            <input type="hidden" name="job_id" value={j.id} />
            <button type="submit" className="text-sm text-red-600 hover:underline">Cancel</button>
          </form>
        ))}
      </section>
    </AipShell>
  );
}
