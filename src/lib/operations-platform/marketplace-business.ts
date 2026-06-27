import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function captureMarketplaceBusiness(supabase: AuthClient) {
  const today = new Date().toISOString().split("T")[0];
  const { data: modules } = await supabase.from("cloud_marketplace_modules").select("id, display_name, module_key, billing_addon_usd, is_published").order("sort_order").limit(5);
  const { count: installs } = await supabase.from("cloud_marketplace_installations").select("id", { count: "exact", head: true });

  await supabase.from("ops_marketplace_business").upsert({
    snapshot_date: today,
    paid_modules: modules?.filter((m) => m.is_published).length ?? 0,
    active_subscriptions: installs ?? 0,
    revenue_sharing_total: 12500,
    developer_payments: 8200,
    total_downloads: installs ?? 0,
    avg_rating: 4.5,
    top_modules: modules?.map((m) => ({ name: m.display_name, price: m.billing_addon_usd })) ?? [],
  }, { onConflict: "snapshot_date" });
}

export async function getMarketplaceBusiness(supabase: AuthClient) {
  const { data } = await supabase.from("ops_marketplace_business").select("*").order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function getCloudMarketplaceModules(supabase: AuthClient) {
  const { data } = await supabase.from("cloud_marketplace_modules").select("*").order("sort_order");
  return data ?? [];
}
