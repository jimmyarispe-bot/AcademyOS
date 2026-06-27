import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ModuleMarketplacePanel } from "@/components/configuration/ModuleMarketplacePanel";
import { loadConfigPage } from "@/lib/configuration/page-data";
import { getModuleMarketplace } from "@/lib/configuration/modules";

export default async function ModulesPage() {
  const { supabase, organizationId } = await loadConfigPage();
  const modules = await getModuleMarketplace(supabase, organizationId);

  return (
    <ConfigStudioShell title="Module Marketplace" subtitle="Enable, disable, and manage AcademyOS modules">
      <ModuleMarketplacePanel organizationId={organizationId} modules={modules} />
    </ConfigStudioShell>
  );
}
