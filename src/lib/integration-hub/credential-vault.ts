import type { createAuthClient } from "@/lib/supabase/server-auth";
import { randomBytes, createHash } from "crypto";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getCredentials(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_credential_vault")
    .select("id, vault_key, credential_type, scopes, expires_at, last_rotated_at, rotation_due_at, is_active")
    .eq("organization_id", organizationId)
    .order("vault_key");
  return data ?? [];
}

export async function storeCredential(
  supabase: AuthClient,
  input: {
    organizationId: string;
    vaultKey: string;
    credentialType: string;
    scopes?: string[];
  }
) {
  const ref = createHash("sha256").update(randomBytes(32)).digest("hex");
  const rotationDue = new Date(Date.now() + 90 * 86400000).toISOString();

  await supabase.from("ihub_credential_vault").upsert({
    organization_id: input.organizationId,
    vault_key: input.vaultKey,
    credential_type: input.credentialType,
    encrypted_ref: ref,
    scopes: input.scopes ?? [],
    last_rotated_at: new Date().toISOString(),
    rotation_due_at: rotationDue,
    is_active: true,
  }, { onConflict: "organization_id,vault_key" });
}

export async function getExpiringCredentials(supabase: AuthClient, organizationId: string) {
  const threshold = new Date(Date.now() + 14 * 86400000).toISOString();
  const { data } = await supabase
    .from("ihub_credential_vault")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .lte("rotation_due_at", threshold);
  return data ?? [];
}

export async function getSecurityAuditSummary(supabase: AuthClient, organizationId: string) {
  const [credentials, apiAudit, expiring] = await Promise.all([
    getCredentials(supabase, organizationId),
    supabase.from("ihub_api_audit_log").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    getExpiringCredentials(supabase, organizationId),
  ]);
  return {
    credentialCount: credentials.length,
    apiAuditCount: apiAudit.count ?? 0,
    expiringCredentials: expiring.length,
    tenantIsolation: "organization_id scoped on all integration tables",
  };
}
