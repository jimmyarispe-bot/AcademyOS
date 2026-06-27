import { PageHeader } from "@/components/ui/PageHeader";
import { getFundingProgramCatalog } from "@/lib/admissions/state-funding";
import { getSchools } from "@/lib/admissions/queries";
import { FundingProgramCatalogTable } from "@/components/admissions/FundingProgramCatalogTable";

export default async function FundingProgramsPage() {
  const [programs, schools] = await Promise.all([
    getFundingProgramCatalog(),
    getSchools(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Funding Program Catalog"
        subtitle="Master catalog of state and scholarship funding programs"
        backHref="/dashboard/admissions"
      />
      <FundingProgramCatalogTable programs={programs} schools={schools} />
    </div>
  );
}
