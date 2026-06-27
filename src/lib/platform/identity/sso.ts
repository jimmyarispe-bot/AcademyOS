/**
 * 28 — External identity / SSO architecture readiness.
 * Current auth (Supabase email/password) remains primary.
 * platform_identity_providers stores future IdP configuration.
 */

import { createAuthClient } from "@/lib/supabase/server-auth";

export async function listIdentityProviders() {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("platform_identity_providers")
    .select("*")
    .order("name");

  return data ?? [];
}

export async function getIdentityProvider(providerKey: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("platform_identity_providers")
    .select("*")
    .eq("provider_key", providerKey)
    .maybeSingle();

  return data;
}

/** Future: map IdP groups/claims to AcademyOS roles via role_mapping jsonb */
export function mapExternalGroupsToRoles(
  providerKey: string,
  externalGroups: string[],
  roleMapping: Record<string, string>
): string[] {
  return externalGroups
    .map((g) => roleMapping[g] ?? roleMapping[`${providerKey}:${g}`])
    .filter(Boolean);
}

/** Future sprint: initiate OAuth/SAML flow without replacing Supabase session */
export async function prepareSsoLogin(_providerKey: string): Promise<{ error: string }> {
  return {
    error: "SSO not enabled — architecture ready in platform_identity_providers. Use email login.",
  };
}
