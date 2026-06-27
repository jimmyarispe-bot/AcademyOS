import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { processQueuedSyncJobs } from "@/lib/enterprise-data/sync-engine";
import { computeQualitySnapshot } from "@/lib/enterprise-data/quality";
import { captureWarehouseSnapshots } from "@/lib/enterprise-data/warehouse";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function syncEnterpriseDataPlatform(supabase: AuthClient) {
  await processQueuedSyncJobs(supabase);

  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return;

  await computeQualitySnapshot(supabase, orgId);
  await captureWarehouseSnapshots(supabase, orgId);

  const { data: failedImports } = await supabase
    .from("edp_import_batches")
    .select("id, import_type, organization_id")
    .eq("status", "failed")
    .gte("started_at", new Date(Date.now() - 86400000).toISOString())
    .limit(10);

  for (const batch of failedImports ?? []) {
    const { data: existing } = await supabase
      .from("platform_mission_control_items")
      .select("id")
      .eq("entity_type", "edp_import_batches")
      .eq("entity_id", batch.id)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existing) continue;

    const { data: school } = await supabase.from("schools").select("id").limit(1).maybeSingle();

    await createMissionControlItem(supabase, {
      schoolId: school?.id ?? "",
      module: "mission_control",
      itemType: "failed_automation",
      title: `Import failed: ${batch.import_type}`,
      body: "Review import batch in Enterprise Data Platform",
      href: "/dashboard/data/import",
      entityType: "edp_import_batches",
      entityId: batch.id,
      assignedRole: "SCHOOL_LEADER",
      severity: "high",
    });
  }
}
