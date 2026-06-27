import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm, ConfigJsonPreview } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";

export default async function IntegrationsConfigPage() {
  const { organizationId, config } = await loadConfigPage("integrations");

  return (
    <ConfigStudioShell title="Integrations" subtitle="Square, QuickBooks, Google, Microsoft, Clever, webhooks, and API keys">
      <ConfigSectionForm
        sectionKey="integrations"
        organizationId={organizationId}
        title="Integration connections"
        config={config}
        fields={[
          { name: "square", label: "Square (JSON)", placeholder: '{"enabled":false}' },
          { name: "quickbooks", label: "QuickBooks (JSON)", placeholder: '{"enabled":false}' },
          { name: "google_workspace", label: "Google Workspace (JSON)", placeholder: '{"enabled":false}' },
          { name: "clever", label: "Clever (JSON)", placeholder: '{"enabled":false}' },
        ]}
      />
      <ConfigJsonPreview config={config} />
    </ConfigStudioShell>
  );
}
