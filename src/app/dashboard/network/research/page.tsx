import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getResearchReports } from "@/lib/intelligence-network/research-warehouse";
import { AinShell } from "@/components/intelligence-network/AinNav";
import { PrivacyNotice } from "@/components/intelligence-network/AinPanels";

export default async function NetworkResearchPage() {
  await requirePagePermission(["network.view", "network.manage", "network.admin"]);
  const supabase = await createAuthClient();
  const reports = await getResearchReports(supabase);

  return (
    <AinShell title="Research Platform" subtitle="Anonymized educational research — interventions, staffing models, financial sustainability, academic correlations">
      <PrivacyNotice />
      <div className="space-y-4">
        {reports.map((r) => (
          <article key={r.id} className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">{r.report_title}</h2>
            <p className="text-sm text-slate-600">{r.summary}</p>
            <p className="mt-2 text-xs text-slate-500">{r.peer_organizations_count} peer organizations · {r.report_category}</p>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(r.findings, null, 2)}</pre>
          </article>
        ))}
      </div>
    </AinShell>
  );
}
