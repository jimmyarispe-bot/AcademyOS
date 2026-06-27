import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getLatestReadiness } from "@/lib/certification/readiness";
import { getLaunchReadinessReport } from "@/lib/certification/launch-readiness-report";
import { getLatestPwaChecks } from "@/lib/certification/pwa-engine";
import { getLatestSupportReadiness } from "@/lib/certification/support-readiness";
import { getLatestHealthReports } from "@/lib/certification/health-reports";
import { getLatestAuditFindings, getAuditSummary } from "@/lib/certification/platform-audit";
import { CertShell } from "@/components/certification/CertNav";
import {
  V1CertifiedBadge, LaunchReadinessPanel, RunCertButton, CertTable,
  PlatformHealthReportPanel, V1LaunchCertificationPanel,
} from "@/components/certification/CertPanels";
import { READINESS_THRESHOLD } from "@/lib/certification/types";

export default async function CertificationLaunchPage() {
  await requirePagePermission(["certification.view", "certification.admin"]);
  const supabase = await createAuthClient();
  const [readiness, pwa, support, reports, auditFindings, auditSummary, launchReport] = await Promise.all([
    getLatestReadiness(supabase),
    getLatestPwaChecks(supabase),
    getLatestSupportReadiness(supabase),
    getLatestHealthReports(supabase),
    getLatestAuditFindings(supabase),
    getAuditSummary(supabase),
    getLaunchReadinessReport(supabase),
  ]);

  return (
    <CertShell title="Launch Readiness Dashboard" subtitle={`Version 1.0 Enterprise — all domains must score ≥ ${READINESS_THRESHOLD}%`}>
      <RunCertButton />
      <V1CertifiedBadge certified={readiness?.is_v1_certified ?? false} />
      <V1LaunchCertificationPanel certified={readiness?.is_v1_certified ?? false} scores={readiness} />
      {launchReport ? (
        <p className="text-sm text-slate-600">
          Latest Launch Readiness Report generated {new Date(launchReport.updated_at ?? launchReport.created_at).toLocaleString()} — view in{" "}
          <a href="/dashboard/certification/documentation" className="text-indigo-600 underline">Documentation Center</a> ({launchReport.doc_title}).
        </p>
      ) : (
        <p className="text-sm text-amber-700">Run full certification to generate the Launch Readiness Report.</p>
      )}
      <LaunchReadinessPanel scores={readiness} />
      <PlatformHealthReportPanel findings={auditFindings} summary={auditSummary} />
      <section>
        <h2 className="mb-2 font-semibold">PWA Certification</h2>
        <CertTable rows={pwa} columns={[{ key: "check_name", label: "Check" }, { key: "status", label: "Status" }]} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Support Readiness ({support.score.toFixed(0)}%)</h2>
        <CertTable rows={support.checks} columns={[{ key: "check_name", label: "Check" }, { key: "status", label: "Status" }, { key: "score", label: "Score" }]} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Operational Reports</h2>
        <CertTable rows={reports} columns={[{ key: "report_type", label: "Report" }, { key: "report_date", label: "Date" }, { key: "health_score", label: "Health Score" }]} />
      </section>
    </CertShell>
  );
}
