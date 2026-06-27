import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { PlatformModule, QueueJobStatus } from "@/lib/platform/automation/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface EnqueueJobInput {
  schoolId?: string | null;
  module: PlatformModule;
  jobType: string;
  entityType?: string | null;
  entityId?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  scheduledFor?: string;
  priority?: number;
  payload?: Record<string, unknown>;
  maxRetries?: number;
}

export async function enqueuePlatformJob(
  supabase: AuthClient,
  input: EnqueueJobInput
) {
  const { data, error } = await supabase
    .from("platform_queue_jobs")
    .insert({
      school_id: input.schoolId ?? null,
      module: input.module,
      job_type: input.jobType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      source_table: input.sourceTable ?? null,
      source_id: input.sourceId ?? null,
      scheduled_for: input.scheduledFor ?? new Date().toISOString(),
      priority: input.priority ?? 0,
      payload: input.payload ?? {},
      max_retries: input.maxRetries ?? 3,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[platform-queue] enqueue:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function updatePlatformJobStatus(
  supabase: AuthClient,
  jobId: string,
  status: QueueJobStatus,
  extra?: { lastError?: string; startedAt?: string; completedAt?: string; retryCount?: number }
) {
  await supabase
    .from("platform_queue_jobs")
    .update({
      status,
      last_error: extra?.lastError ?? null,
      started_at: extra?.startedAt,
      completed_at: extra?.completedAt,
      retry_count: extra?.retryCount,
    })
    .eq("id", jobId);
}

export async function syncAdmissionsQueueToPlatform(supabase: AuthClient) {
  const { data: pending } = await supabase
    .from("admissions_workflow_queue")
    .select("id, lead_id, trigger_event, status, scheduled_for, retry_count, last_error, application_id")
    .in("status", ["pending", "processing", "failed"])
    .limit(25);

  for (const item of pending ?? []) {
    const { data: lead } = await supabase
      .from("admissions_leads")
      .select("school_id")
      .eq("id", item.lead_id)
      .single();

    const platformStatus: QueueJobStatus =
      item.status === "processing"
        ? "running"
        : item.status === "failed"
          ? "failed"
          : "pending";

    const { data: existing } = await supabase
      .from("platform_queue_jobs")
      .select("id")
      .eq("source_table", "admissions_workflow_queue")
      .eq("source_id", item.id)
      .maybeSingle();

    if (existing) {
      await updatePlatformJobStatus(supabase, existing.id, platformStatus, {
        lastError: item.last_error,
        retryCount: item.retry_count,
      });
    } else {
      await enqueuePlatformJob(supabase, {
        schoolId: lead?.school_id,
        module: "admissions",
        jobType: item.trigger_event,
        entityType: "admissions_lead",
        entityId: item.lead_id,
        sourceTable: "admissions_workflow_queue",
        sourceId: item.id,
        scheduledFor: item.scheduled_for,
        payload: { application_id: item.application_id },
      });
    }
  }
}

export async function getPlatformQueueMetrics(supabase: AuthClient) {
  const statuses: QueueJobStatus[] = [
    "pending",
    "running",
    "failed",
    "retrying",
    "completed",
  ];

  const counts: Record<string, number> = {};
  for (const status of statuses) {
    const { count } = await supabase
      .from("platform_queue_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    counts[status] = count ?? 0;
  }
  return counts;
}
