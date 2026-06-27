import { FundingReconciliation } from "@/components/admissions/FundingReconciliation";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getReconciliationByAward,
  getReconciliationSummary,
} from "@/lib/admissions/state-funding";

export default async function ReconciliationPage() {
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
