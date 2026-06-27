import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getConnectorCertifications } from "@/lib/integration-hub/connector-certification";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";

export default async function CertificationCenterPage() {
  await requirePagePermission(["integration.view", "integration.admin"]);
  const supabase = await createAuthClient();
  const certifications = await getConnectorCertifications(supabase);

  return (
    <IntHubShell title="Connector Certification Center" subtitle="Reliability, security, and performance scores — certification badges, compatibility, marketplace ratings">
      <IntHubTable rows={certifications} columns={[
        { key: "connector_key", label: "Connector" },
        { key: "certification_status", label: "Status" },
        { key: "reliability_score", label: "Reliability" },
        { key: "security_score", label: "Security" },
        { key: "performance_score", label: "Performance" },
        { key: "health_rating", label: "Health" },
        { key: "marketplace_rating", label: "Rating" },
        { key: "version", label: "Version" },
        { key: "support_status", label: "Support" },
      ]} />
      <p className="text-sm text-slate-600">Certification statuses: certified, verified, preview, beta, deprecated, unsupported.</p>
    </IntHubShell>
  );
}
