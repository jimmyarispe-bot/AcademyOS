import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getInvoices, getContracts } from "@/lib/cloud-platform/billing";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsBillingPage() {
  await requireOperationsPermission(["operations.billing"]);
  const supabase = await createAuthClient();
  const [invoices, contracts] = await Promise.all([getInvoices(supabase), getContracts(supabase)]);

  return (
    <OpsShell title="Billing Operations" subtitle="Invoices, contracts, taxes, coupons, credits, refunds, and prorations">
      <h2 className="font-semibold">Invoices</h2>
      <OpsTable rows={invoices} columns={[
        { key: "invoice_number", label: "Invoice" }, { key: "status", label: "Status" },
        { key: "total_usd", label: "Total" }, { key: "due_date", label: "Due" },
      ]} />
      <h2 className="font-semibold">Contracts</h2>
      <OpsTable rows={contracts} columns={[
        { key: "contract_number", label: "Contract" }, { key: "contract_type", label: "Type" },
        { key: "total_value_usd", label: "Value" }, { key: "status", label: "Status" },
      ]} />
    </OpsShell>
  );
}
