import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { getHubData } from "@/lib/intelligence-platform/monitoring";
import { AipShell } from "@/components/intelligence-platform/AipNav";
import { AipHub } from "@/components/intelligence-platform/AipHub";
import { MonitoringPanel, RefreshAipButton, ArchitectureNotice, FutureUseCasesPanel } from "@/components/intelligence-platform/AipPanels";

export default async function IntelligenceHubPage() {
  await requirePagePermission(["ai.view", "ai.use", "ai.manage", "ai.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const hub = orgId ? await getHubData(supabase, orgId) : null;

  return (
    <AipShell
      title="Enterprise Intelligence Platform"
      subtitle="Central AI readiness framework — governance, orchestration, and extensibility for every module"
    >
      <div className="flex justify-end">
        <RefreshAipButton />
      </div>
      <ArchitectureNotice />
      {hub && <MonitoringPanel monitoring={hub.monitoring} />}
      <AipHub />
      <section>
        <h2 className="mb-3 font-semibold">Future AI use cases</h2>
        <FutureUseCasesPanel />
      </section>
    </AipShell>
  );
}
