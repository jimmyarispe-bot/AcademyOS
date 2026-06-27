import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getSystemStatus } from "@/lib/cloud-platform/monitoring";
import { CloudShell } from "@/components/cloud-platform/CloudNav";

export default async function CloudSystemStatusPage() {
  await requireCloudPermission();
  const supabase = await createAuthClient();
  const components = await getSystemStatus(supabase);

  return (
    <CloudShell title="System Status" subtitle="Public status page — uptime, incidents, and maintenance">
      <div className="grid gap-3 sm:grid-cols-2">
        {components.map((c) => (
          <div key={c.component_key} className="flex items-center justify-between rounded-xl border bg-white p-4">
            <span className="font-medium">{c.display_name}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              c.status === "operational" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
            }`}>{c.status}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500">Uptime and historical availability tracked per component.</p>
    </CloudShell>
  );
}
