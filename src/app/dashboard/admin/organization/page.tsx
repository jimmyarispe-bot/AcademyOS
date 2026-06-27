import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm } from "@/components/configuration/ConfigSectionForm";
import { OrganizationHierarchyPanel } from "@/components/platform/admin/OrganizationHierarchyPanel";
import { getOrganizationHierarchy } from "@/lib/platform/identity/org";
import { loadConfigPage } from "@/lib/configuration/page-data";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";

export default async function OrganizationAdminPage() {
  await requirePagePermission("org.view");
  const hierarchy = await getOrganizationHierarchy();
  const { organizationId, config } = await loadConfigPage("organization");

  return (
    <ConfigStudioShell title="Organization" subtitle="Legal profile, mission, vision, and hierarchy">
      <ConfigSectionForm
        sectionKey="organization"
        organizationId={organizationId}
        title="Organization profile"
        config={config}
        fields={[
          { name: "legal_name", label: "Legal name" },
          { name: "tax_id", label: "Tax ID" },
          { name: "website", label: "Website" },
          { name: "mission", label: "Mission", type: "textarea" },
          { name: "vision", label: "Vision", type: "textarea" },
          { name: "timezone", label: "Time zone" },
        ]}
      />
      <OrganizationHierarchyPanel hierarchy={hierarchy} />
    </ConfigStudioShell>
  );
}
