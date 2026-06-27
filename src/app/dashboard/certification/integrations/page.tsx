import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getLatestIntegrationHealth } from "@/lib/certification/integration-engine";
import { CertShell } from "@/components/certification/CertNav";
import { CertTable } from "@/components/certification/CertPanels";

export default async function CertificationIntegrationsPage() {
  await requirePagePermission(["certification.view", "certification.admin"]);
  const supabase = await createAuthClient();
  const integrations = await getLatestIntegrationHealth(supabase);

  return (
    <CertShell title="Integration Certification" subtitle="QuickBooks, Google, Microsoft, NWEA, email, SMS, API, webhooks">
      <CertTable rows={integrations} columns={[
        { key: "integration_name", label: "Integration" }, { key: "status", label: "Status" },
      ]} />
    </CertShell>
  );
}
