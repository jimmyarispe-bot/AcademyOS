import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getOrganizations, getProvisioningJobs } from "@/lib/cloud-platform/provisioning";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";
import { provisionOrgAction } from "@/lib/cloud-platform/actions";
import { PROVISIONING_BLUEPRINTS } from "@/lib/cloud-platform/types";

export default async function CloudOrganizationsPage() {
  await requireCloudPermission(["cloud.admin", "cloud.operations", "cloud.sales"]);
  const supabase = await createAuthClient();
  const [orgs, jobs, customers] = await Promise.all([
    getOrganizations(supabase), getProvisioningJobs(supabase), getCustomers(supabase),
  ]);

  return (
    <CloudShell title="Organization Provisioning" subtitle="One-click provisioning with blueprints">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <form action={provisionOrgAction} className="space-y-3">
          <label className="block text-sm">
            Organization name
            <input name="org_name" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required />
          </label>
          <label className="block text-sm">
            Blueprint
            <select name="blueprint_key" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
              {PROVISIONING_BLUEPRINTS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            Link to customer
            <select name="customer_id" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
              <option value="">None</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Provision</button>
        </form>
      </section>
      <CloudTable rows={orgs} columns={[{ key: "customer_name", label: "Customer" }, { key: "status", label: "Status" }]} />
      <h2 className="mt-6 font-semibold">Recent jobs</h2>
      <CloudTable rows={jobs} columns={[{ key: "target_org_name", label: "Org" }, { key: "blueprint_key", label: "Blueprint" }, { key: "status", label: "Status" }]} />
    </CloudShell>
  );
}
