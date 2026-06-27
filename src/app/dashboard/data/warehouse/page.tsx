import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { getWarehouseSnapshots, getTrendAnalysis } from "@/lib/enterprise-data/warehouse";
import { EdpShell } from "@/components/enterprise-data/EdpNav";
import { RefreshEdpButton } from "@/components/enterprise-data/EdpPanels";

export default async function DataWarehousePage() {
  await requirePagePermission(["data.view", "data.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const [snapshots, enrollmentTrend] = orgId
    ? await Promise.all([
        getWarehouseSnapshots(supabase, orgId),
        getTrendAnalysis(supabase, orgId, "enrollment"),
      ])
    : [[], []];

  return (
    <EdpShell title="Data Warehouse" subtitle="Historical snapshots for enrollment, finance, attendance, HR, compliance, and executive KPIs">
      <div className="flex justify-end">
        <RefreshEdpButton />
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Recent snapshots</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {snapshots.map((s) => (
            <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-medium capitalize">{String(s.domain).replace(/_/g, " ")}</p>
              <p className="text-slate-500">{s.snapshot_date}</p>
              <pre className="mt-2 overflow-x-auto text-xs text-slate-600">
                {JSON.stringify(s.metrics, null, 2)}
              </pre>
            </li>
          ))}
          {!snapshots.length && <li className="text-slate-500">No warehouse snapshots yet — refresh to capture.</li>}
        </ul>
      </section>

      {enrollmentTrend.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Enrollment trend</h2>
          <ul className="space-y-1 text-sm">
            {enrollmentTrend.map((t) => (
              <li key={t.date} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{t.date}</span>
                <span>{JSON.stringify(t.metrics)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </EdpShell>
  );
}
