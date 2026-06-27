import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/** v1.0: Live OAuth sync is not available — only file/CSV import paths are supported. */
export const V1_SYNC_MODE = "file_import_only" as const;

export async function queueSyncJob(
  supabase: AuthClient,
  input: {
    organizationId: string;
    connectorInstanceId?: string;
    syncType?: string;
    direction?: string;
  }
) {
  const { data, error } = await supabase
    .from("edp_sync_jobs")
    .insert({
      organization_id: input.organizationId,
      connector_instance_id: input.connectorInstanceId ?? null,
      sync_type: input.syncType ?? "manual",
      direction: input.direction ?? "import",
      status: "queued",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { jobId: data.id };
}

export async function runSyncJob(supabase: AuthClient, jobId: string) {
  await supabase.from("edp_sync_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", jobId);

  await supabase.from("edp_sync_logs").insert({
    sync_job_id: jobId,
    log_level: "info",
    message: "Sync started",
  });

  const skippedMessage =
    "OAuth/API connector sync is not available in v1.0. Use file import (CSV, QuickBooks export) via Data Platform or Financial Intelligence import.";

  await supabase.from("edp_sync_jobs").update({
    status: "failed",
    records_processed: 0,
    completed_at: new Date().toISOString(),
    error_message: skippedMessage,
  }).eq("id", jobId);

  await supabase.from("edp_sync_logs").insert({
    sync_job_id: jobId,
    log_level: "warning",
    message: skippedMessage,
  });

  return { success: false, skipped: true, message: skippedMessage };
}

export async function getSyncHistory(supabase: AuthClient, organizationId: string, limit = 20) {
  const { data } = await supabase
    .from("edp_sync_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getSyncLogs(supabase: AuthClient, jobId: string) {
  const { data } = await supabase
    .from("edp_sync_logs")
    .select("*")
    .eq("sync_job_id", jobId)
    .order("created_at");
  return data ?? [];
}

export async function processQueuedSyncJobs(supabase: AuthClient) {
  const { data: jobs } = await supabase
    .from("edp_sync_jobs")
    .select("id")
    .eq("status", "queued")
    .limit(10);

  for (const job of jobs ?? []) {
    await runSyncJob(supabase, job.id);
  }
}
