import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getPartners(supabase: AuthClient) {
  const { data } = await supabase.from("ops_partners").select("*").order("performance_score", { ascending: false });
  return data ?? [];
}

export async function createPartner(
  supabase: AuthClient,
  input: { partnerName: string; partnerType: string; revenueSharePct?: number }
) {
  const { data, error } = await supabase
    .from("ops_partners")
    .insert({
      partner_name: input.partnerName,
      partner_type: input.partnerType,
      revenue_share_pct: input.revenueSharePct ?? 15,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { partnerId: data.id };
}
