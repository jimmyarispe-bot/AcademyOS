import type { createAuthClient } from "@/lib/supabase/server-auth";
import { randomBytes, createHash } from "crypto";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getApiKeys(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("edp_api_keys")
    .select("id, key_name, key_prefix, scopes, rate_limit_per_minute, is_active, expires_at, last_used_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getOAuthClients(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_oauth_clients")
    .select("id, client_name, client_id, scopes, api_version, is_active, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createApiKey(
  supabase: AuthClient,
  input: { organizationId: string; keyName: string; scopes?: string[]; createdBy?: string }
) {
  const rawKey = `aos_${randomBytes(24).toString("hex")}`;
  const prefix = rawKey.slice(0, 12);
  const hash = createHash("sha256").update(rawKey).digest("hex");

  const { data, error } = await supabase
    .from("edp_api_keys")
    .insert({
      organization_id: input.organizationId,
      key_name: input.keyName,
      key_prefix: prefix,
      key_hash: hash,
      scopes: input.scopes ?? ["read", "write"],
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { keyId: data.id, apiKey: rawKey, prefix };
}

export async function logApiCall(
  supabase: AuthClient,
  input: {
    organizationId: string | null;
    method: string;
    path: string;
    authType: "api_key" | "oauth" | "sandbox";
    statusCode: number;
    latencyMs: number;
    rateLimited?: boolean;
    actorId?: string;
  }
) {
  await supabase.from("ihub_api_audit_log").insert({
    organization_id: input.organizationId,
    method: input.method,
    path: input.path,
    auth_type: input.authType,
    status_code: input.statusCode,
    latency_ms: input.latencyMs,
    rate_limited: input.rateLimited ?? false,
    actor_id: input.actorId ?? null,
  });
}

export async function getApiAuditLog(supabase: AuthClient, organizationId: string, limit = 50) {
  const { data } = await supabase
    .from("ihub_api_audit_log")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
