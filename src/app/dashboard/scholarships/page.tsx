import { StatCard } from "@/components/dashboard/StatCard";
import { ScholarshipReviewList } from "@/components/scholarships/ScholarshipReviewList";
import { ScholarshipCenterPanel } from "@/components/scholarships/ScholarshipCenterPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { FundingBreakdown } from "@/components/ui/FundingBreakdown";
import { SCHOLARSHIP_APPROVER } from "@/lib/constants/admissions";
import { formatCount, formatCurrency } from "@/lib/format";
import { getSchools } from "@/lib/finance/queries";
import {
  getApprovedScholarshipAwards,
  getScholarshipApplications,
  getScholarshipFunds,
  getScholarshipStats,
} from "@/lib/scholarships/queries";

export default async function ScholarshipsPage() {
  const [applications, stats, funds, awards, schools] = await Promise.all([
    getScholarshipApplications(),
    getScholarshipStats(),
    getScholarshipFunds(),
    getApprovedScholarshipAwards(),
    getSchools(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Scholarship Management"
        subtitle={`Review workflow — Approver: ${SCHOLARSHIP_APPROVER}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Applications" value={formatCount(stats.total)} description="Total applications" accent="indigo" icon={<span className="text-lg font-bold">A</span>} />
        <StatCard title="Pending Review" value={formatCount(stats.pending)} description="Awaiting decision" accent="amber" icon={<span className="text-lg font-bold">P</span>} />
        <StatCard title="Approved" value={formatCount(stats.approved)} description="Awarded scholarships" accent="emerald" icon={<span className="text-lg font-bold">✓</span>} />
        <StatCard title="Total Awarded" value={formatCurrency(stats.totalAwarded)} description="Approved amounts" accent="violet" icon={<span className="text-lg font-bold">$</span>} />
      </div>

      <FundingBreakdown
        title="Funding Report"
        byFunding={stats.byFunding}
        byCategory={stats.byCategory}
      />

      <ScholarshipCenterPanel funds={funds} awards={awards} schools={schools} />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Review Queue</h2>
        <p className="mb-4 text-sm text-slate-500">
          Tax return documents are uploaded via scholarship_documents with document_type &quot;tax_return&quot;.
        </p>
        <ScholarshipReviewList applications={applications} />
      </section>
    </div>
  );
}
