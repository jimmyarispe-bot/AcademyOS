import { PageHeader } from "@/components/ui/PageHeader";
import { SecurityDashboardPanel } from "@/components/platform/admin/SecurityDashboardPanel";
import { getAdminDashboardData } from "@/lib/platform/identity/queries";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";

export default async function SecurityAdminPage() {
  await requirePagePermission("security.view");
  const { securityStats, securityEvents, impersonationHistory } = await getAdminDashboardData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Security Dashboard"
        subtitle="Failed logins, permission changes, impersonation, and audit statistics"
        backHref="/dashboard/admin"
      />
      <SecurityDashboardPanel
        stats={securityStats}
        events={securityEvents}
        impersonationHistory={impersonationHistory}
      />
    </div>
  );
}
