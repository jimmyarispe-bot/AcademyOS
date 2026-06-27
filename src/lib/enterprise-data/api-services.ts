import { createHash, randomBytes } from "crypto";
import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export function generateApiKey(): { prefix: string; raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const prefix = raw.slice(0, 8);
  const hash = createHash("sha256").update(raw).digest("hex");
  return { prefix, raw, hash };
}

export async function createApiKey(
  supabase: AuthClient,
  input: {
    organizationId: string;
    keyName: string;
    scopes?: string[];
    rateLimitPerMinute?: number;
    createdBy?: string;
    expiresAt?: string;
  }
) {
  const { prefix, raw, hash } = generateApiKey();
  const { data, error } = await supabase
    .from("edp_api_keys")
    .insert({
      organization_id: input.organizationId,
      key_name: input.keyName,
      key_prefix: prefix,
      key_hash: hash,
      scopes: input.scopes ?? ["read"],
      rate_limit_per_minute: input.rateLimitPerMinute ?? 60,
      created_by: input.createdBy ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select("id, key_prefix")
    .single();

  if (error) return { error: error.message };
  return { keyId: data.id, apiKey: raw, prefix: data.key_prefix };
}

export async function listApiKeys(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("edp_api_keys")
    .select("id, key_name, key_prefix, scopes, rate_limit_per_minute, is_active, expires_at, last_used_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function revokeApiKey(supabase: AuthClient, keyId: string) {
  await supabase.from("edp_api_keys").update({ is_active: false }).eq("id", keyId);
}

export const API_PLATFORM_ARCHITECTURE = {
  versioning: "v1",
  authMethods: ["api_key", "oauth_ready"],
  rateLimiting: "per-key configurable",
  scopes: ["read", "write", "students", "finance", "hr", "sync"],
  auditLogging: "platform_audit_events",
  documentation: "/api/data/docs",
};
