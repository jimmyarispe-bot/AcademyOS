import { PageHeader } from "@/components/ui/PageHeader";
import { getFundingProgramCatalog } from "@/lib/admissions/state-funding";
import { getSchools } from "@/lib/admissions/queries";
import { FundingProgramCatalogTable } from "@/components/admissions/FundingProgramCatalogTable";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";

/**
 * Funding is money, and money is not admissions.
 *
 * This page lived inside /dashboard/admissions, so the only thing standing in
 * front of it was the admissions layout's `admissions.view`. Anybody who could
 * open the lead list could open state funding, award amounts and reconciliation
 * — including a School Leader whose remit is admissions and nothing else.
 *
 * Being filed under admissions in the routing tree is not a statement about who
 * should see it. The guard now asks for a funding permission, which School
 * Leaders are denied (migration 349).
 */
export default async function FundingProgramsPage() {
  await requirePagePermission(["funding.view", "funding.verify", "finance.state_funding", "finance.view"]);
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
