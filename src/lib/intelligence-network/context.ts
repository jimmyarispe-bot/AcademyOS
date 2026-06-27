import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getPrimaryOrganizationId(supabase: AuthClient): Promise<string | null> {
  const { data } = await supabase.from("org_organizations").select("id").limit(1).maybeSingle();
  return data?.id ?? null;
}
