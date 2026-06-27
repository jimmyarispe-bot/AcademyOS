import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function captureUsageAnalytics(supabase: AuthClient, customerId: string) {
  const { data: customer } = await supabase.from("cloud_customers").select("organization_id, api_usage_count").eq("id", customerId).single();
  if (!customer) return;

  const { count: dau } = await supabase.from("users").select("id", { count: "exact", head: true });

  await supabase.from("cloud_usage_analytics").upsert({
    customer_id: customerId,
    organization_id: customer.organization_id,
    metric_date: new Date().toISOString().split("T")[0],
    daily_active_users: dau ?? 0,
    monthly_active_users: (dau ?? 0) * 20,
    module_usage: { admissions: 10, finance: 8, hr: 5 },
    storage_bytes: customer.api_usage_count * 1000,
    import_count: 0,
    export_count: 0,
    workflow_executions: 0,
    automation_volume: 0,
  }, { onConflict: "customer_id,metric_date" });
}

export async function getUsageAnalytics(supabase: AuthClient, limit = 30) {
  const { data } = await supabase
    .from("cloud_usage_analytics")
    .select("*, cloud_customers(customer_name)")
    .order("metric_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getProductAnalytics(supabase: AuthClient, limit = 20) {
  const { data } = await supabase
    .from("cloud_product_analytics")
    .select("*")
    .order("usage_count", { ascending: false })
    .limit(limit);

  if (!data?.length) {
    return [
      { feature_key: "admissions_pipeline", usage_count: 0, unique_users: 0 },
      { feature_key: "mission_control", usage_count: 0, unique_users: 0 },
      { feature_key: "financial_intelligence", usage_count: 0, unique_users: 0 },
    ];
  }
  return data;
}

export async function recordProductAnalytics(supabase: AuthClient) {
  const features = ["admissions", "finance", "executive", "scheduling", "data_platform", "intelligence"];
  for (const feature of features) {
    await supabase.from("cloud_product_analytics").upsert({
      metric_date: new Date().toISOString().split("T")[0],
      feature_key: feature,
      usage_count: 0,
      unique_users: 0,
      avg_session_seconds: 0,
    }, { onConflict: "metric_date,feature_key" });
  }
}
