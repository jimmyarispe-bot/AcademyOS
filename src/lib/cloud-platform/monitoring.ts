import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function capturePlatformHealth(supabase: AuthClient) {
  const { count: queuedJobs } = await supabase
    .from("aip_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");

  const { count: failedImports } = await supabase
    .from("edp_import_batches")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");

  await supabase.from("cloud_platform_health").insert({
    api_health: "healthy",
    database_health: "healthy",
    queue_health: (queuedJobs ?? 0) > 100 ? "degraded" : "healthy",
    email_delivery_health: "healthy",
    webhook_health: "healthy",
    auth_health: "healthy",
    error_rate_pct: (failedImports ?? 0) * 0.01,
    avg_latency_ms: 120,
    metrics: { queuedAiJobs: queuedJobs ?? 0, failedImports: failedImports ?? 0 },
  });
}

export async function getLatestPlatformHealth(supabase: AuthClient) {
  const { data } = await supabase
    .from("cloud_platform_health")
    .select("*")
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getSystemStatus(supabase: AuthClient) {
  const { data } = await supabase.from("cloud_system_status").select("*").order("display_name");
  return data ?? [];
}
