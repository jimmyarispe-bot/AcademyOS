import { PageHeader } from "@/components/ui/PageHeader";
import { ComplianceDashboardPanel } from "@/components/platform/admin/ComplianceDashboardPanel";
import { getComplianceDashboard } from "@/lib/platform/identity/compliance";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";

export default async function ComplianceAdminPage() {
  await requirePagePermission("compliance.view");
  const data = await getComplianceDashboard();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Compliance Dashboard"
        subtitle="FERPA, funding, scholarships, security events, and outstanding approvals"
        backHref="/dashboard/admin"
      />
      <ComplianceDashboardPanel
        stats={data.stats}
        recentSecurityEvents={data.recentSecurityEvents}
        pendingApprovals={data.pendingApprovals}
      />
    </div>
  );
}
