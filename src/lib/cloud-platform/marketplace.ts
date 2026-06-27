import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getMarketplaceModules(supabase: AuthClient) {
  const { data } = await supabase.from("cloud_marketplace_modules").select("*").order("sort_order");
  return data ?? [];
}

export async function getInstallations(supabase: AuthClient, customerId?: string) {
  let query = supabase
    .from("cloud_marketplace_installations")
    .select("*, cloud_customers(customer_name), cloud_marketplace_modules(display_name)")
    .order("installed_at", { ascending: false });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data } = await query.limit(50);
  return data ?? [];
}

export async function installModule(
  supabase: AuthClient,
  input: { customerId: string; moduleKey: string; version?: string }
) {
  const { data: mod } = await supabase.from("cloud_marketplace_modules").select("version").eq("module_key", input.moduleKey).single();

  const { error } = await supabase.from("cloud_marketplace_installations").upsert({
    customer_id: input.customerId,
    module_key: input.moduleKey,
    version: input.version ?? mod?.version ?? "1.0.0",
    status: "installed",
  }, { onConflict: "customer_id,module_key" });

  if (error) return { error: error.message };
  return { success: true };
}
