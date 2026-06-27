import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { getSubscriptionPlans } from "@/lib/cloud-platform/subscriptions";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";
import { createCustomerAction } from "@/lib/cloud-platform/actions";

export default async function CloudCustomersPage() {
  await requireCloudPermission(["cloud.admin", "cloud.sales", "cloud.support"]);
  const supabase = await createAuthClient();
  const [customers, plans] = await Promise.all([getCustomers(supabase), getSubscriptionPlans(supabase)]);

  return (
    <CloudShell title="Customer Management" subtitle="Organizations, health scores, subscriptions, and support tiers">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <form action={createCustomerAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block flex-1 text-sm">
            Customer name
            <input name="customer_name" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required />
          </label>
          <label className="block text-sm">
            Plan
            <select name="plan_key" className="mt-1 block rounded-lg border border-slate-200 px-3 py-2">
              {plans.map((p) => <option key={p.plan_key} value={p.plan_key}>{p.display_name}</option>)}
            </select>
          </label>
          <input type="hidden" name="customer_slug" value={`cust-${Date.now()}`} />
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Add customer</button>
        </form>
      </section>
      <CloudTable rows={customers} columns={[
        { key: "customer_name", label: "Customer" }, { key: "status", label: "Status" },
        { key: "health_score", label: "Health" }, { key: "risk_level", label: "Risk" },
        { key: "student_count", label: "Students" }, { key: "support_tier", label: "Tier" },
      ]} />
    </CloudShell>
  );
}
