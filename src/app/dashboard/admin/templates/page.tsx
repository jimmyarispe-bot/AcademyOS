import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";

export default async function TemplatesConfigPage() {
  const { organizationId, config } = await loadConfigPage("communications");

  return (
    <ConfigStudioShell title="Templates" subtitle="Email, SMS, and portal message templates">
      <ConfigSectionForm
        sectionKey="communications"
        organizationId={organizationId}
        title="Template library"
        description="Templates stored in configuration — version history tracked on save"
        config={config}
        fields={[]}
      />
      <p className="text-sm text-slate-500">Use communications configuration or workflow marketplace for template management.</p>
    </ConfigStudioShell>
  );
}
