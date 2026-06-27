import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { listCloneJobs } from "@/lib/enterprise-data/clone-engine";
import { EdpShell } from "@/components/enterprise-data/EdpNav";
import { HistoryTable } from "@/components/enterprise-data/EdpPanels";
import { startCloneAction } from "@/lib/enterprise-data/actions";

export default async function DataClonePage() {
  await requirePagePermission(["data.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const jobs = orgId ? await listCloneJobs(supabase, orgId) : [];

  return (
    <EdpShell title="Organization Cloning" subtitle="Clone organizations, schools, campuses, programs, configuration, and blueprints">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={startCloneAction} className="space-y-4">
          <label className="block text-sm">
            Clone type
            <select name="clone_type" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
              <option value="organization">Entire organization</option>
              <option value="school">Single school</option>
              <option value="campus">Campus</option>
              <option value="program">Programs</option>
              <option value="blueprint">Blueprint deployment</option>
            </select>
          </label>
          <input type="hidden" name="source_scope" value='{"type":"current"}' />
          <input type="hidden" name="target_scope" value='{"type":"new"}' />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="include_users" value="true" />
            Include users (optional)
          </label>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Start clone job
          </button>
        </form>
      </section>

      <section className="text-sm text-slate-600">
        <p>Clones configuration, playbooks, workflows, templates, automation, dashboards, branding,
        financial settings, compliance, and permissions. Supports blueprint-based deployments.</p>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Clone jobs</h2>
        <HistoryTable
          rows={jobs}
          columns={[
            { key: "clone_type", label: "Type" },
            { key: "status", label: "Status" },
            { key: "progress_pct", label: "Progress" },
            { key: "created_at", label: "Started" },
          ]}
        />
      </section>
    </EdpShell>
  );
}
