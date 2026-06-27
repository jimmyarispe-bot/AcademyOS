import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-network/context";
import { getForecasts } from "@/lib/intelligence-network/forecast-engine";
import { AinShell } from "@/components/intelligence-network/AinNav";
import { PrivacyNotice } from "@/components/intelligence-network/AinPanels";

export default async function NetworkForecastingPage() {
  await requirePagePermission(["network.view", "network.manage", "network.admin"]);
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return null;
  const forecasts = await getForecasts(supabase, orgId);

  return (
    <AinShell title="Network Forecasting" subtitle="Predict enrollment, revenue, staffing, cash flow, capacity, compliance risk, intervention demand">
      <PrivacyNotice />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {forecasts.map((f) => (
          <div key={f.id} className="rounded-xl border bg-white p-4 text-sm">
            <p className="font-semibold capitalize">{String(f.forecast_type).replace(/_/g, " ")}</p>
            <p className="text-slate-500">Confidence: {f.confidence_pct}%</p>
            <p className="mt-1 text-slate-700">{JSON.stringify(f.projections)}</p>
          </div>
        ))}
      </div>
      {!forecasts.length && <p className="text-sm text-slate-500">Opt in and sync to generate forecasts.</p>}
    </AinShell>
  );
}
