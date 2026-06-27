import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getPrimaryOrganizationId(supabase: AuthClient): Promise<string | null> {
  const { data: org } = await supabase
    .from("org_organizations")
    .select("id")
    .eq("slug", "the-academy-way")
    .maybeSingle();

  if (org?.id) return org.id;

  const { data: first } = await supabase.from("org_organizations").select("id").limit(1).maybeSingle();
  return first?.id ?? null;
}

export async function getOrganizationRecord(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase.from("org_organizations").select("*").eq("id", organizationId).maybeSingle();
  return data;
}
