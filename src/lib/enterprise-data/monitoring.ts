import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { MonitoringSummary } from "@/lib/enterprise-data/types";
import { getImportHistory } from "@/lib/enterprise-data/import-engine";
import { getExportHistory } from "@/lib/enterprise-data/export-engine";
import { getSyncHistory } from "@/lib/enterprise-data/sync-engine";
import { getConnectorHealthReport } from "@/lib/enterprise-data/connectors";
import { listBackups } from "@/lib/enterprise-data/backup-engine";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getMonitoringSummary(
  supabase: AuthClient,
  organizationId: string
): Promise<MonitoringSummary> {
  const [imports, exports, syncs, connectors, backups] = await Promise.all([
    getImportHistory(supabase, organizationId, 50),
    getExportHistory(supabase, organizationId, 50),
    getSyncHistory(supabase, organizationId, 50),
    getConnectorHealthReport(supabase, organizationId),
    listBackups(supabase, organizationId),
  ]);

  return {
    importCount: imports.length,
    exportCount: exports.length,
    syncCount: syncs.length,
    failedImports: imports.filter((i) => i.status === "failed").length,
    failedExports: exports.filter((e) => e.status === "failed").length,
    failedSyncs: syncs.filter((s) => s.status === "failed").length,
    connectorHealth: connectors.map((c) => ({
      connectorKey: c.connector_key,
      healthStatus: c.health_status,
    })),
  };
}

export async function getEdpHubData(supabase: AuthClient, organizationId: string) {
  const [monitoring, importSummary, quality] = await Promise.all([
    getMonitoringSummary(supabase, organizationId),
    supabase.from("rpt_edp_import_summary").select("*").eq("organization_id", organizationId),
    supabase.from("rpt_edp_quality_summary").select("*").eq("organization_id", organizationId).limit(1).maybeSingle(),
  ]);

  return {
    monitoring,
    importSummary: importSummary.data ?? [],
    quality: quality.data,
  };
}
