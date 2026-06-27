import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { getEdpHubData } from "@/lib/enterprise-data/monitoring";
import { EdpShell } from "@/components/enterprise-data/EdpNav";
import { EdpHub } from "@/components/enterprise-data/EdpHub";
import { MonitoringPanel, RefreshEdpButton, AiReadinessPanel } from "@/components/enterprise-data/EdpPanels";
import Link from "next/link";

export default async function DataHubPage() {
  await requirePagePermission(["data.view", "data.manage", "data.import", "data.export", "data.admin", "fi.import"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const hub = orgId ? await getEdpHubData(supabase, orgId) : null;

  return (
    <EdpShell
      title="Enterprise Data Platform"
      subtitle="Central data exchange — import, export, sync, validate, archive, and analyze across every AcademyOS module"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/data/import" className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
            Migration wizard →
          </Link>
          <Link href="/dashboard/data/connectors" className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
            Connectors →
          </Link>
        </div>
        <RefreshEdpButton />
      </div>

      {hub && <MonitoringPanel monitoring={hub.monitoring} />}
      <EdpHub />
      <AiReadinessPanel />
    </EdpShell>
  );
}
