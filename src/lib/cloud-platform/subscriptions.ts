import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getSubscriptionPlans(supabase: AuthClient) {
  const { data } = await supabase.from("cloud_subscription_plans").select("*").order("sort_order");
  return data ?? [];
}

export async function getSubscriptions(supabase: AuthClient, customerId?: string) {
  let query = supabase.from("cloud_subscriptions").select("*, cloud_customers(customer_name)").order("created_at", { ascending: false });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data } = await query.limit(50);
  return data ?? [];
}

export async function createSubscription(
  supabase: AuthClient,
  input: {
    customerId: string;
    planKey: string;
    billingCycle?: string;
    monthlyAmountUsd?: number;
  }
) {
  const { data: plan } = await supabase.from("cloud_subscription_plans").select("*").eq("plan_key", input.planKey).single();

  const { data, error } = await supabase
    .from("cloud_subscriptions")
    .insert({
      customer_id: input.customerId,
      plan_key: input.planKey,
      status: input.planKey === "free_trial" ? "trial" : "active",
      billing_cycle: input.billingCycle ?? plan?.billing_cycle ?? "monthly",
      monthly_amount_usd: input.monthlyAmountUsd ?? plan?.base_price_usd ?? 0,
      student_limit: plan?.student_price_usd ? 500 : null,
      storage_limit_gb: plan?.storage_limit_gb,
      api_limit_per_month: plan?.api_limit_per_month,
      current_period_start: new Date().toISOString().split("T")[0],
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { subscriptionId: data.id };
}

export async function getMrr(supabase: AuthClient) {
  const { data } = await supabase.from("rpt_cloud_mrr").select("*").maybeSingle();
  return Number(data?.total_mrr ?? 0);
}
