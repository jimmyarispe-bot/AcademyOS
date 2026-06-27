import { PageHeader } from "@/components/ui/PageHeader";
import { WorkflowMarketplacePanel } from "@/components/platform/WorkflowMarketplacePanel";
import { getMarketplaceTemplates } from "@/lib/platform/automation/marketplace";
import { getSchools } from "@/lib/finance/queries";

export default async function WorkflowMarketplacePage() {
  const [templates, schools] = await Promise.all([getMarketplaceTemplates(), getSchools()]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Workflow Marketplace"
        subtitle="Reusable automation templates for every AcademyOS module"
        backHref="/dashboard/mission-control"
      />
      <WorkflowMarketplacePanel templates={templates} schools={schools} />
    </div>
  );
}
