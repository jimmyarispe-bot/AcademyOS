import type { createAuthClient } from "@/lib/supabase/server-auth";
import { queueSyncJob, runSyncJob, getSyncHistory } from "@/lib/enterprise-data/sync-engine";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export { getSyncHistory };

export async function queueIntegrationSync(
  supabase: AuthClient,
  input: {
    organizationId: string;
    connectorInstanceId?: string;
    syncMode?: "realtime" | "scheduled" | "manual";
    direction?: "import" | "export" | "bidirectional";
  }
) {
  const syncType = input.syncMode === "realtime" ? "incremental" : input.syncMode === "scheduled" ? "scheduled" : "manual";
  return queueSyncJob(supabase, {
    organizationId: input.organizationId,
    connectorInstanceId: input.connectorInstanceId,
    syncType,
    direction: input.direction ?? "bidirectional",
  });
}

export async function getSyncSchedules(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_sync_schedules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("schedule_name");
  return data ?? [];
}

export async function getSyncConflicts(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ihub_sync_conflicts")
    .select("*")
    .eq("organization_id", organizationId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function resolveSyncConflict(
  supabase: AuthClient,
  conflictId: string,
  resolution: "local_wins" | "remote_wins" | "merged"
) {
  await supabase.from("ihub_sync_conflicts").update({
    resolution,
    resolved_at: new Date().toISOString(),
  }).eq("id", conflictId);
}

export async function processIntegrationSyncQueue(supabase: AuthClient) {
  const { data: jobs } = await supabase.from("edp_sync_jobs").select("id").eq("status", "queued").limit(10);
  for (const job of jobs ?? []) {
    await runSyncJob(supabase, job.id);
  }
}

export async function getSyncAuditTrail(supabase: AuthClient, organizationId: string, limit = 30) {
  const { data: jobs } = await supabase
    .from("edp_sync_jobs")
    .select("id, sync_type, direction, status, records_processed, conflicts_detected, started_at, completed_at, error_message")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return jobs ?? [];
}
