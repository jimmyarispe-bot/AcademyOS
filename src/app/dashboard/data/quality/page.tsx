import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { getLatestQualitySnapshot, computeQualitySnapshot } from "@/lib/enterprise-data/quality";
import { EdpShell } from "@/components/enterprise-data/EdpNav";
import { QualityScorePanel, RefreshEdpButton } from "@/components/enterprise-data/EdpPanels";

export default async function DataQualityPage() {
  await requirePagePermission(["data.view", "data.manage", "data.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);

  let snapshot = orgId ? await getLatestQualitySnapshot(supabase, orgId) : null;
  if (orgId && !snapshot) {
    const report = await computeQualitySnapshot(supabase, orgId);
    snapshot = {
      quality_score: report.qualityScore,
      issues: report.issues,
      corrective_actions: report.correctiveActions,
    } as typeof snapshot;
  }

  return (
    <EdpShell title="Data Quality Center" subtitle="Duplicate detection, broken relationships, incomplete records, and corrective actions">
      <div className="flex justify-end">
        <RefreshEdpButton />
      </div>

      {snapshot && (
        <QualityScorePanel
          score={Number(snapshot.quality_score ?? 0)}
          issues={(snapshot.issues as Array<{ message: string; severity: string }>) ?? []}
          actions={(snapshot.corrective_actions as string[]) ?? []}
        />
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <p>Automatically identifies duplicate students and families, missing contacts, broken relationships,
        invalid IDs, incomplete records, missing funding, stale records, and orphaned files.</p>
      </section>
    </EdpShell>
  );
}
