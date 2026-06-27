import Link from "next/link";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getOperationsHubSummary } from "@/lib/operations-platform/hub";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsSummaryPanel, RefreshOpsButton, AiReadinessNotice } from "@/components/operations-platform/OpsPanels";
import { OPS_NAV } from "@/lib/operations-platform/types";

export default async function OperationsHomePage() {
  await requireOperationsPermission(["operations.view"]);
  const supabase = await createAuthClient();
  const summary = await getOperationsHubSummary(supabase);
  const links = OPS_NAV.filter((l) => l.href !== "/operations");

  return (
    <OpsShell title="AcademyOS Operations Platform" subtitle="Operate, support, bill, monitor, secure, and grow AcademyOS as a commercial SaaS product">
      <RefreshOpsButton />
      <OpsSummaryPanel summary={summary} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-2xl border bg-white p-4 shadow-sm hover:border-indigo-300">
            <h3 className="font-semibold">{l.label}</h3>
          </Link>
        ))}
      </div>
      <AiReadinessNotice />
    </OpsShell>
  );
}
