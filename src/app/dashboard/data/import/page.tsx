import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { getImportHistory } from "@/lib/enterprise-data/import-engine";
import { getActiveMigrationSessions } from "@/lib/enterprise-data/migration-wizard";
import { EdpShell } from "@/components/enterprise-data/EdpNav";
import { HistoryTable, ImportWizardSteps } from "@/components/enterprise-data/EdpPanels";
import { runImportAction, startMigrationAction } from "@/lib/enterprise-data/actions";
import { IMPORT_TYPES, MIGRATION_STEPS } from "@/lib/enterprise-data/types";

export default async function DataImportPage() {
  await requirePagePermission(["data.import", "data.admin", "fi.import"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [history, sessions] = orgId
    ? await Promise.all([
        getImportHistory(supabase, orgId),
        getActiveMigrationSessions(supabase, orgId),
      ])
    : [[], []];

  const activeSession = sessions[0];

  return (
    <EdpShell title="Import Center" subtitle="Migration wizard — upload, mapping, validation, preview, import, verification">
      {activeSession && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Active migration</h2>
          <ImportWizardSteps currentStep={activeSession.current_step} />
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">Start import</h2>
        <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          v1.0 commit is supported for QuickBooks and Financial Transactions only. Other import types validate and stage records but do not write to domain tables until a future release.
        </p>
        <form action={runImportAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Import type
              <select name="import_type" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                {IMPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Format
              <select name="source_format" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
                <option value="zip">ZIP</option>
                <option value="quickbooks">QuickBooks</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            CSV content (paste for demo)
            <textarea name="file_content" rows={6} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" placeholder="first_name,last_name,email,school_id&#10;Jane,Doe,jane@example.com," />
          </label>
          <input type="hidden" name="file_name" value="import.csv" />
          <div className="flex gap-3">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Validate & stage
            </button>
            <button type="submit" name="commit" value="true" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
              Commit import
            </button>
          </div>
        </form>
        <form action={startMigrationAction} className="mt-4">
          <button type="submit" className="text-sm text-brand-600 hover:underline">
            Start new migration session
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Migration steps</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {MIGRATION_STEPS.map((s) => (
            <li key={s.key} className="rounded-lg bg-slate-100 px-3 py-1">{s.label}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Import history</h2>
        <HistoryTable
          rows={history}
          columns={[
            { key: "import_type", label: "Type" },
            { key: "source_format", label: "Format" },
            { key: "status", label: "Status" },
            { key: "row_count", label: "Rows" },
            { key: "success_count", label: "Success" },
            { key: "error_count", label: "Errors" },
          ]}
        />
      </section>
    </EdpShell>
  );
}
