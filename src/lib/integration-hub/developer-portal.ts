import type { createAuthClient } from "@/lib/supabase/server-auth";
import { randomBytes, createHash } from "crypto";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getDeveloperApps(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_developer_apps")
    .select("*")
    .eq("organization_id", organizationId)
    .order("app_name");
  return data ?? [];
}

export async function getSandboxKeys(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_sandbox_keys")
    .select("id, key_name, key_prefix, scopes, expires_at, is_active, created_at, developer_app_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createSandboxKey(
  supabase: AuthClient,
  input: { organizationId: string; keyName: string; developerAppId?: string; scopes?: string[] }
) {
  const rawKey = `aos_sandbox_${randomBytes(20).toString("hex")}`;
  const prefix = rawKey.slice(0, 16);
  const hash = createHash("sha256").update(rawKey).digest("hex");

  const { data, error } = await supabase
    .from("ihub_sandbox_keys")
    .insert({
      organization_id: input.organizationId,
      developer_app_id: input.developerAppId ?? null,
      key_name: input.keyName,
      key_prefix: prefix,
      key_hash: hash,
      scopes: input.scopes ?? ["read"],
      expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { keyId: data.id, sandboxKey: rawKey };
}

export async function getUsageAnalytics(supabase: AuthClient, organizationId: string) {
  const { count: apiCalls } = await supabase
    .from("ihub_api_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  const { count: events } = await supabase
    .from("ihub_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return { apiCalls: apiCalls ?? 0, eventsPublished: events ?? 0 };
}
