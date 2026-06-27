import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getCertHubData } from "@/lib/certification/certification-engine";
import { getBugs } from "@/lib/certification/bug-center";
import { CertShell } from "@/components/certification/CertNav";
import { V1CertifiedBadge, LaunchReadinessPanel, RunCertButton, RefreshHealthButton, BugSummaryPanel, CertTable } from "@/components/certification/CertPanels";
import Link from "next/link";
import { CERT_NAV } from "@/lib/certification/types";

export default async function CertificationOverviewPage() {
  await requirePagePermission(["certification.view", "certification.manage", "certification.admin"]);
  const supabase = await createAuthClient();
  const [hub, bugs] = await Promise.all([getCertHubData(supabase), getBugs(supabase)]);
  const links = CERT_NAV.filter((l) => l.href !== "/dashboard/certification/overview");

  return (
    <CertShell title="Enterprise Certification Center" subtitle="Continuous validation of quality, security, scalability, accessibility, and launch readiness">
      <div className="flex flex-wrap gap-3">
        <RunCertButton /><RefreshHealthButton />
      </div>
      <V1CertifiedBadge certified={hub.readiness?.is_v1_certified ?? false} />
      <LaunchReadinessPanel scores={hub.readiness} />
      <section>
        <h2 className="mb-2 text-lg font-semibold">Bug & Quality Center</h2>
        <BugSummaryPanel summary={hub.bugSummary} />
        <div className="mt-3"><CertTable rows={bugs.slice(0, 8)} columns={[
          { key: "title", label: "Bug" }, { key: "severity", label: "Severity" },
          { key: "status", label: "Status" }, { key: "affected_module", label: "Module" },
          { key: "assigned_engineer", label: "Engineer" },
        ]} /></div>
      </section>
      {hub.healthReports.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Health Reports</h2>
          <CertTable rows={hub.healthReports} columns={[
            { key: "report_type", label: "Type" }, { key: "report_date", label: "Date" }, { key: "health_score", label: "Score" },
          ]} />
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-2xl border bg-white p-4 shadow-sm hover:border-emerald-300">
            <h3 className="font-semibold">{l.label}</h3>
          </Link>
        ))}
      </div>
    </CertShell>
  );
}
