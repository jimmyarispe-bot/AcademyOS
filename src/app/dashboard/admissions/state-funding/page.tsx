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

export default async function StateFundingPage() {
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
