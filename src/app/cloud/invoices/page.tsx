import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getInvoices } from "@/lib/cloud-platform/billing";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";
import { createInvoiceAction } from "@/lib/cloud-platform/actions";

export default async function CloudInvoicesPage() {
  await requireCloudPermission(["cloud.admin", "cloud.finance"]);
  const supabase = await createAuthClient();
  const [invoices, customers] = await Promise.all([getInvoices(supabase), getCustomers(supabase)]);

  return (
    <CloudShell title="Invoices" subtitle="Generate invoices, receipts, and payment history">
      <form action={createInvoiceAction} className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <select name="customer_id" className="rounded-lg border px-3 py-2 text-sm">
          {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
        </select>
        <input name="amount" type="number" placeholder="Amount USD" className="rounded-lg border px-3 py-2 text-sm" required />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create invoice</button>
      </form>
      <CloudTable rows={invoices} columns={[
        { key: "invoice_number", label: "Number" }, { key: "amount_usd", label: "Amount" },
        { key: "status", label: "Status" }, { key: "due_date", label: "Due" },
      ]} />
    </CloudShell>
  );
}
