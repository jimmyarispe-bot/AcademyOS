import { Suspense } from "react";
import Link from "next/link";
import { FundingExportForm } from "@/components/admissions/FundingExportForm";
import { StateFundingList } from "@/components/admissions/StateFundingList";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSchools } from "@/lib/admissions/queries";
import {
  getFundingProgramCatalog,
  getStateFundingAwards,
} from "@/lib/admissions/state-funding";
import { requireFinanceAccess } from "@/lib/platform/identity/page-guard";
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
export default async function StateFundingPage() {
  await requirePagePermission(["funding.view", "funding.verify", "finance.state_funding", "finance.view"]);
  // Sprint 008 — Financial Security.
  await requireFinanceAccess();
  const [awards, programs, schools] = await Promise.all([
    getStateFundingAwards(),
    getFundingProgramCatalog(),
    getSchools(),
  ]);

  const states = [...new Set(programs.map((p) => p.state_code))].sort();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="State Funding Management"
        subtitle="Track awards, verification, and program assignments"
        backHref="/dashboard/admissions"
      />

      <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-slate-100" />}>
        <FundingExportForm
          states={states}
          programs={programs.map((p) => ({ id: p.id, program_name: p.program_name }))}
          schools={schools}
        />
      </Suspense>

      <StateFundingList awards={awards} programs={programs} />
    </div>
  );
}
