import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getContracts } from "@/lib/cloud-platform/billing";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";
import { createContractAction } from "@/lib/cloud-platform/actions";

export default async function CloudContractsPage() {
  await requireCloudPermission(["cloud.admin", "cloud.sales", "cloud.finance"]);
  const supabase = await createAuthClient();
  const [contracts, customers] = await Promise.all([getContracts(supabase), getCustomers(supabase)]);

  return (
    <CloudShell title="Contracts" subtitle="Enterprise agreements, renewals, and terms">
      <form action={createContractAction} className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <select name="customer_id" className="rounded-lg border px-3 py-2 text-sm">
          {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
        </select>
        <input name="start_date" type="date" className="rounded-lg border px-3 py-2 text-sm" required />
        <input name="total_value" type="number" placeholder="Total USD" className="rounded-lg border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create contract</button>
      </form>
      <CloudTable rows={contracts} columns={[
        { key: "contract_number", label: "Number" }, { key: "status", label: "Status" },
        { key: "start_date", label: "Start" }, { key: "total_value_usd", label: "Value" },
      ]} />
    </CloudShell>
  );
}
