import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getSubscriptions, getSubscriptionPlans } from "@/lib/cloud-platform/subscriptions";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";
import { createSubscriptionAction } from "@/lib/operations-platform/actions";
import { SUBSCRIPTION_TIERS } from "@/lib/operations-platform/types";

export default async function OperationsSubscriptionsPage() {
  await requireOperationsPermission(["operations.view", "operations.billing"]);
  const supabase = await createAuthClient();
  const [subs, plans, customers] = await Promise.all([getSubscriptions(supabase), getSubscriptionPlans(supabase), getCustomers(supabase)]);

  return (
    <OpsShell title="Subscription Management" subtitle="Trial, monthly, annual, enterprise, district, statewide, international — renewals, upgrades, suspensions, prorations">
      <p className="text-sm text-slate-600">Supported tiers: {SUBSCRIPTION_TIERS.join(", ")}</p>
      <form action={createSubscriptionAction} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <select name="customer_id" className="rounded-lg border px-3 py-2 text-sm" required>
          <option value="">Customer…</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
        </select>
        <select name="plan_key" className="rounded-lg border px-3 py-2 text-sm">
          {plans.map((p) => <option key={p.plan_key} value={p.plan_key}>{p.display_name}</option>)}
        </select>
        <select name="billing_cycle" className="rounded-lg border px-3 py-2 text-sm">
          <option value="monthly">Monthly</option><option value="annual">Annual</option>
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create subscription</button>
      </form>
      <OpsTable rows={subs} columns={[
        { key: "plan_key", label: "Plan" }, { key: "status", label: "Status" },
        { key: "billing_cycle", label: "Cycle" }, { key: "monthly_amount_usd", label: "MRR" },
        { key: "current_period_end", label: "Period End" },
      ]} />
    </OpsShell>
  );
}
