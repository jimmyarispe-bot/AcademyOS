import type { createAuthClient } from "@/lib/supabase/server-auth";
import { METERING_DIMENSIONS } from "@/lib/integration-hub/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function captureUsageMetering(supabase: AuthClient, organizationId: string) {
  const today = new Date().toISOString().split("T")[0];
  const dayAgo = new Date(Date.now() - 86400000).toISOString();

  const [users, students, apiCalls, webhooks, syncJobs, workflowRuns] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("ihub_api_audit_log").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("created_at", dayAgo),
    supabase.from("ihub_events").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("published_at", dayAgo),
    supabase.from("edp_sync_jobs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("ihub_automation_runs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
  ]);

  const meter = {
    users_count: users.count ?? 0,
    students_count: students.count ?? 0,
    api_calls: apiCalls.count ?? 0,
    webhook_calls: webhooks.count ?? 0,
    sync_jobs: syncJobs.count ?? 0,
    workflow_runs: workflowRuns.count ?? 0,
    automation_runs: workflowRuns.count ?? 0,
    connector_executions: syncJobs.count ?? 0,
    storage_mb: 256,
    bandwidth_mb: 64,
    subscription_limit: { api_calls: 100000, storage_mb: 10240 },
    overages: {},
    forecast: { api_calls_next_month: (apiCalls.count ?? 0) * 30 },
  };

  await supabase.from("ihub_usage_metering").upsert({
    organization_id: organizationId,
    meter_date: today,
    ...meter,
  }, { onConflict: "organization_id,meter_date" });

  return meter;
}

export async function getUsageMetering(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_usage_metering")
    .select("*")
    .eq("organization_id", organizationId)
    .order("meter_date", { ascending: false })
    .limit(30);
  return data ?? [];
}

export function getMeteringDimensions() {
  return METERING_DIMENSIONS;
}
