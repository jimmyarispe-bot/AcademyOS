import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getMrr } from "@/lib/cloud-platform/subscriptions";
import { getInvoices } from "@/lib/cloud-platform/billing";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";

export default async function CloudBillingPage() {
  await requireCloudPermission(["cloud.admin", "cloud.finance"]);
  const supabase = await createAuthClient();
  const [mrr, invoices] = await Promise.all([getMrr(supabase), getInvoices(supabase)]);

  return (
    <CloudShell title="Customer Billing" subtitle="Subscriptions, renewals, credits, refunds, and payment history">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">MRR</p><p className="text-2xl font-bold">${mrr.toFixed(2)}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Open invoices</p><p className="text-2xl font-bold">{invoices.filter((i) => i.status === "sent").length}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Paid</p><p className="text-2xl font-bold">{invoices.filter((i) => i.status === "paid").length}</p></div>
      </div>
      <CloudTable rows={invoices.slice(0, 10)} columns={[
        { key: "invoice_number", label: "Invoice" }, { key: "amount_usd", label: "Amount" }, { key: "status", label: "Status" },
      ]} />
    </CloudShell>
  );
}
