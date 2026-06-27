import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getLatestPlatformHealth } from "@/lib/cloud-platform/monitoring";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { RefreshCloudButton } from "@/components/cloud-platform/CloudPanels";

export default async function CloudPlatformHealthPage() {
  await requireCloudPermission(["cloud.admin", "cloud.operations"]);
  const supabase = await createAuthClient();
  const health = await getLatestPlatformHealth(supabase);

  return (
    <CloudShell title="Platform Health" subtitle="API, database, queues, email, webhooks, auth, latency, and error rates">
      <div className="flex justify-end"><RefreshCloudButton /></div>
      {health ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {["api_health", "database_health", "queue_health", "email_delivery_health", "webhook_health", "auth_health"].map((k) => (
            <div key={k} className="rounded-xl border bg-white p-4 text-sm">
              <p className="text-slate-500 capitalize">{k.replace(/_/g, " ")}</p>
              <p className="font-semibold">{String(health[k as keyof typeof health])}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No health snapshot — sync platform to capture.</p>
      )}
    </CloudShell>
  );
}
