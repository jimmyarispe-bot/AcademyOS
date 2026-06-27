import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { getExportHistory } from "@/lib/enterprise-data/export-engine";
import { EdpShell } from "@/components/enterprise-data/EdpNav";
import { HistoryTable } from "@/components/enterprise-data/EdpPanels";
import { runExportAction } from "@/lib/enterprise-data/actions";

export default async function DataExportPage() {
  await requirePagePermission(["data.export", "data.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const history = orgId ? await getExportHistory(supabase, orgId) : [];

  return (
    <EdpShell title="Export Center" subtitle="Export operational data in CSV, Excel, JSON, XML, or ZIP packages">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={runExportAction} className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            Export type
            <select name="export_type" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2">
              <option value="students">Students</option>
              <option value="employees">Employees</option>
            </select>
          </label>
          <label className="block text-sm">
            Format
            <select name="export_format" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2">
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="excel">Excel</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Run export
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Export history</h2>
        <HistoryTable
          rows={history}
          columns={[
            { key: "export_type", label: "Type" },
            { key: "export_format", label: "Format" },
            { key: "status", label: "Status" },
            { key: "row_count", label: "Rows" },
          ]}
        />
      </section>
    </EdpShell>
  );
}
