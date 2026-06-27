import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getCloudHubSummary } from "@/lib/cloud-platform/hub";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudSummaryPanel, RefreshCloudButton, AiReadinessNotice } from "@/components/cloud-platform/CloudPanels";
import Link from "next/link";
import { CLOUD_NAV } from "@/lib/cloud-platform/types";

export default async function CloudHomePage() {
  await requireCloudPermission();
  const supabase = await createAuthClient();
  const summary = await getCloudHubSummary(supabase);
  const links = CLOUD_NAV.filter((l) => l.href !== "/cloud" && l.href !== "/cloud/dashboard");

  return (
    <CloudShell title="Cloud Console" subtitle="Commercial SaaS platform — customers, subscriptions, support, and operations">
      <div className="flex justify-end"><RefreshCloudButton /></div>
      <CloudSummaryPanel summary={summary} />
      <AiReadinessNotice />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.slice(0, 9).map((link) => (
          <Link key={link.href} href={link.href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300">
            <h3 className="font-semibold">{link.label}</h3>
          </Link>
        ))}
      </div>
    </CloudShell>
  );
}
