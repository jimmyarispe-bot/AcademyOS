import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getLicenses(supabase: AuthClient, customerId?: string) {
  let query = supabase.from("cloud_licenses").select("*, cloud_customers(customer_name)").order("created_at", { ascending: false });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data } = await query.limit(50);
  return data ?? [];
}

export async function issueLicense(
  supabase: AuthClient,
  input: {
    customerId: string;
    subscriptionId?: string;
    licensedModules?: string[];
    studentLimit?: number;
    staffLimit?: number;
    storageLimitGb?: number;
    apiLimitPerMonth?: number;
    expiresAt?: string;
  }
) {
  const { data, error } = await supabase
    .from("cloud_licenses")
    .insert({
      customer_id: input.customerId,
      subscription_id: input.subscriptionId ?? null,
      licensed_modules: input.licensedModules ?? [],
      student_limit: input.studentLimit ?? null,
      staff_limit: input.staffLimit ?? null,
      storage_limit_gb: input.storageLimitGb ?? null,
      api_limit_per_month: input.apiLimitPerMonth ?? null,
      expires_at: input.expiresAt ?? null,
      status: "active",
    })
    .select("id, license_key")
    .single();

  if (error) return { error: error.message };
  return { licenseId: data.id, licenseKey: data.license_key };
}

export async function renewLicense(supabase: AuthClient, licenseId: string) {
  await supabase.from("cloud_licenses").update({
    renewed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: "active",
  }).eq("id", licenseId);
}
