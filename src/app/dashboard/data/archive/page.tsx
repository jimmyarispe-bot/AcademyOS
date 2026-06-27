import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { listArchives } from "@/lib/enterprise-data/archive-engine";
import { EdpShell } from "@/components/enterprise-data/EdpNav";
import { HistoryTable } from "@/components/enterprise-data/EdpPanels";
import { createArchiveAction } from "@/lib/enterprise-data/actions";

export default async function DataArchivePage() {
  await requirePagePermission(["data.manage", "data.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const archives = orgId ? await listArchives(supabase, orgId) : [];

  return (
    <EdpShell title="Archive Manager" subtitle="Long-term retention for school years, graduates, finance, communications, and documents">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={createArchiveAction} className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            Archive type
            <select name="archive_type" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2">
              <option value="school_year">School year</option>
              <option value="graduates">Graduates</option>
              <option value="withdrawn_students">Withdrawn students</option>
              <option value="payroll">Historical payroll</option>
              <option value="finance">Historical finance</option>
              <option value="communications">Communications</option>
              <option value="documents">Documents</option>
            </select>
          </label>
          <label className="block text-sm">
            Retention
            <select name="retention_policy" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2">
              <option value="7_years">7 years</option>
              <option value="permanent">Permanent</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create archive
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Archives</h2>
        <HistoryTable
          rows={archives}
          columns={[
            { key: "archive_type", label: "Type" },
            { key: "retention_policy", label: "Retention" },
            { key: "archived_at", label: "Archived" },
          ]}
        />
      </section>
    </EdpShell>
  );
}
