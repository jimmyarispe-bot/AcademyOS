import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm, ConfigJsonPreview } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";

export default async function BrandingConfigPage() {
  const { organizationId, config } = await loadConfigPage("branding");

  return (
    <ConfigStudioShell title="Branding" subtitle="Logos, colors, typography, and portal themes">
      <ConfigSectionForm
        sectionKey="branding"
        organizationId={organizationId}
        title="Organization branding"
        description="All branding stored in configuration — no code changes required"
        config={config}
        fields={[
          { name: "logo_url", label: "Logo URL" },
          { name: "dark_logo_url", label: "Dark logo URL" },
          { name: "favicon_url", label: "Favicon URL" },
          { name: "primary_color", label: "Primary color", type: "color" },
          { name: "secondary_color", label: "Secondary color", type: "color" },
          { name: "accent_color", label: "Accent color", type: "color" },
        ]}
      />
      <ConfigJsonPreview config={config} />
    </ConfigStudioShell>
  );
}
