import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function queueJob(
  supabase: AuthClient,
  input: {
    organizationId: string;
    schoolId?: string;
    module: string;
    jobType?: string;
    promptId?: string;
    promptVersionId?: string;
    providerInstanceId?: string;
    priority?: number;
    scheduledAt?: string;
    requestedBy?: string;
    dependsOnJobId?: string;
  }
) {
  const { data, error } = await supabase
    .from("aip_jobs")
    .insert({
      organization_id: input.organizationId,
      school_id: input.schoolId ?? null,
      module: input.module,
      job_type: input.jobType ?? "inference",
      prompt_id: input.promptId ?? null,
      prompt_version_id: input.promptVersionId ?? null,
      provider_instance_id: input.providerInstanceId ?? null,
      priority: input.priority ?? 5,
      scheduled_at: input.scheduledAt ?? null,
      requested_by: input.requestedBy ?? null,
      depends_on_job_id: input.dependsOnJobId ?? null,
      status: "queued",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { jobId: data.id };
}

export async function processQueuedJobs(supabase: AuthClient) {
  const { data: jobs } = await supabase
    .from("aip_jobs")
    .select("*")
    .eq("status", "queued")
    .order("priority")
    .order("created_at")
    .limit(10);

  for (const job of jobs ?? []) {
    await supabase.from("aip_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", job.id);

    await supabase.from("aip_job_logs").insert({
      job_id: job.id,
      log_level: "info",
      message: "Job simulated — architecture ready for provider invocation",
    });

    await supabase.from("aip_token_usage").insert({
      organization_id: job.organization_id,
      school_id: job.school_id,
      user_id: job.requested_by,
      module: job.module,
      prompt_id: job.prompt_id,
      job_id: job.id,
      tokens_in: 0,
      tokens_out: 0,
      estimated_cost_usd: 0,
      execution_time_ms: 0,
      status: "simulated",
    });

    await supabase.from("aip_audit_logs").insert({
      organization_id: job.organization_id,
      school_id: job.school_id,
      requested_by: job.requested_by,
      prompt_id: job.prompt_id,
      prompt_version_id: job.prompt_version_id,
      job_id: job.id,
      response_status: "simulated",
      execution_time_ms: 0,
      metadata: { note: "No AI provider invoked — Release 12.5 architecture" },
    });

    await supabase.from("aip_jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);
  }
}

export async function getJobs(supabase: AuthClient, organizationId: string, limit = 30) {
  const { data } = await supabase
    .from("aip_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function cancelJob(supabase: AuthClient, jobId: string) {
  await supabase.from("aip_jobs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", jobId);
}

export async function getJobLogs(supabase: AuthClient, jobId: string) {
  const { data } = await supabase.from("aip_job_logs").select("*").eq("job_id", jobId).order("created_at");
  return data ?? [];
}
