import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { processQueuedJobs } from "@/lib/intelligence-platform/queue-engine";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { checkProviderHealth } from "@/lib/intelligence-platform/provider-abstraction";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function syncIntelligencePlatform(supabase: AuthClient) {
  await processQueuedJobs(supabase);

  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return;

  const { data: instances } = await supabase
    .from("aip_provider_instances")
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .limit(10);

  for (const inst of instances ?? []) {
    await checkProviderHealth(supabase, inst.id);
  }

  const { data: failedJobs } = await supabase
    .from("aip_jobs")
    .select("id, module, organization_id")
    .eq("status", "failed")
    .gte("created_at", new Date(Date.now() - 86400000).toISOString())
    .limit(10);

  for (const job of failedJobs ?? []) {
    const { data: existing } = await supabase
      .from("platform_mission_control_items")
      .select("id")
      .eq("entity_type", "aip_jobs")
      .eq("entity_id", job.id)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existing) continue;

    const { data: school } = await supabase.from("schools").select("id").limit(1).maybeSingle();

    await createMissionControlItem(supabase, {
      schoolId: school?.id ?? "",
      module: "mission_control",
      itemType: "failed_automation",
      title: `AI job failed: ${job.module}`,
      body: "Review job in Intelligence Platform",
      href: "/dashboard/intelligence/jobs",
      entityType: "aip_jobs",
      entityId: job.id,
      assignedRole: "SCHOOL_LEADER",
      severity: "high",
    });
  }
}
