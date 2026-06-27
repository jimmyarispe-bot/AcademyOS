import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getLatestSecuritySummary } from "@/lib/certification/security-engine";
import { CertShell } from "@/components/certification/CertNav";
import { CertTable } from "@/components/certification/CertPanels";

export default async function CertificationSecurityPage() {
  await requirePagePermission(["certification.view", "certification.admin"]);
  const supabase = await createAuthClient();
  const { score, checks, criticalFindings, recommendations } = await getLatestSecuritySummary(supabase);

  return (
    <CertShell title="Security Certification" subtitle="RLS, FERPA, tenant isolation, audit, MFA, secrets, webhooks, and API keys">
      <p className="text-2xl font-bold">Security Score: {score.toFixed(1)}</p>
      {criticalFindings.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-semibold text-red-800">Critical Findings</p>
          <ul className="mt-1 list-disc pl-5">{criticalFindings.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      {recommendations.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold">Recommendations</p>
          <ul className="mt-1 list-disc pl-5">{recommendations.slice(0, 6).map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
      <CertTable rows={checks} columns={[
        { key: "check_name", label: "Check" }, { key: "status", label: "Status" }, { key: "score", label: "Score" },
      ]} />
    </CertShell>
  );
}
