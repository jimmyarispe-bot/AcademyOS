import { FundingReconciliation } from "@/components/admissions/FundingReconciliation";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getReconciliationByAward,
  getReconciliationSummary,
} from "@/lib/admissions/state-funding";
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
export default async function ReconciliationPage() {
  await requirePagePermission(["funding.view", "funding.verify", "finance.state_funding", "finance.view"]);
  const [summary, byAward] = await Promise.all([
    getReconciliationSummary(),
    getReconciliationByAward(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Funding Reconciliation"
        subtitle="Expected state funding vs payments received"
        backHref="/dashboard/admissions"
      />
      <FundingReconciliation summary={summary} byAward={byAward} />
    </div>
  );
}
