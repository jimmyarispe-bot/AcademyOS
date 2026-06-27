import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { MonitoringSummary } from "@/lib/intelligence-platform/types";
import { getProviderInstances } from "@/lib/intelligence-platform/provider-abstraction";
import { getCostSummary } from "@/lib/intelligence-platform/token-tracking";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getMonitoringSummary(
  supabase: AuthClient,
  organizationId: string
): Promise<MonitoringSummary> {
  const [jobs, providers, costs, queueHealth] = await Promise.all([
    supabase.from("aip_jobs").select("status, started_at, completed_at").eq("organization_id", organizationId),
    getProviderInstances(supabase, organizationId),
    getCostSummary(supabase, organizationId),
    supabase.from("rpt_aip_queue_health").select("*").eq("organization_id", organizationId),
  ]);

  const jobList = jobs.data ?? [];
  const queued = jobList.filter((j) => j.status === "queued").length;
  const running = jobList.filter((j) => j.status === "running").length;
  const failed = jobList.filter((j) => j.status === "failed").length;

  const completedJobs = jobList.filter((j) => j.started_at && j.completed_at);
  const avgResponseTimeMs = completedJobs.length
    ? completedJobs.reduce((s, j) => {
        const ms = new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime();
        return s + ms;
      }, 0) / completedJobs.length
    : 0;

  return {
    queueHealth: { queued, running, failed },
    providerHealth: providers.map((p) => ({ providerKey: p.provider_key, healthStatus: p.health_status })),
    avgResponseTimeMs,
    estimatedDailyCost: costs.dailyCost,
    failureCount: failed,
  };
}

export async function getHubData(supabase: AuthClient, organizationId: string) {
  const [monitoring, pendingApprovals, recentAudit] = await Promise.all([
    getMonitoringSummary(supabase, organizationId),
    supabase.from("aip_approvals").select("id").eq("organization_id", organizationId).eq("status", "pending"),
    supabase.from("aip_audit_logs").select("id").eq("organization_id", organizationId).limit(10),
  ]);

  return {
    monitoring,
    pendingApprovalCount: pendingApprovals.data?.length ?? 0,
    recentAuditCount: recentAudit.data?.length ?? 0,
  };
}
