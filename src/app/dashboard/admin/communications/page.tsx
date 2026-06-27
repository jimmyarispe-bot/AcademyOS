import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm, ConfigJsonPreview } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";

export default async function CommunicationsConfigPage() {
  const { organizationId, config } = await loadConfigPage("communications");

  return (
    <ConfigStudioShell title="Communications" subtitle="Email, SMS, portal templates, and notification rules">
      <ConfigSectionForm sectionKey="communications" organizationId={organizationId} title="Communication settings" config={config} fields={[{ name: "languages", label: "Languages (comma-separated)", placeholder: "en,es" }]} />
      <ConfigJsonPreview config={config} />
    </ConfigStudioShell>
  );
}
