import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getMarketplaceModules, getInstallations } from "@/lib/cloud-platform/marketplace";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";
import { installModuleAction } from "@/lib/cloud-platform/actions";

export default async function CloudMarketplacePage() {
  await requireCloudPermission(["cloud.admin", "cloud.sales"]);
  const supabase = await createAuthClient();
  const [modules, installations, customers] = await Promise.all([
    getMarketplaceModules(supabase), getInstallations(supabase), getCustomers(supabase),
  ]);

  return (
    <CloudShell title="Module Marketplace" subtitle="Future app store — install, upgrade, version, and license modules">
      <form action={installModuleAction} className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <select name="customer_id" className="rounded-lg border px-3 py-2 text-sm">
          {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
        </select>
        <select name="module_key" className="rounded-lg border px-3 py-2 text-sm">
          {modules.map((m) => <option key={m.module_key} value={m.module_key}>{m.display_name}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Install</button>
      </form>
      <CloudTable rows={modules} columns={[{ key: "display_name", label: "Module" }, { key: "version", label: "Version" }]} />
      <h2 className="mt-6 font-semibold">Installations</h2>
      <CloudTable rows={installations} columns={[{ key: "module_key", label: "Module" }, { key: "status", label: "Status" }]} />
    </CloudShell>
  );
}
