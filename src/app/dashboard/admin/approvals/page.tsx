import { PageHeader } from "@/components/ui/PageHeader";
import { ApprovalMatrixPanel } from "@/components/platform/admin/ApprovalMatrixPanel";
import { getApprovalRules } from "@/lib/platform/identity/approvals";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";

export default async function ApprovalsAdminPage() {
  await requirePagePermission(["approvals.configure", "approvals.review"]);
  const supabase = await createAuthClient();
  const rules = await getApprovalRules(supabase);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Executive Approval Matrix"
        subtitle="Configurable approval chains for scholarships, tuition, payroll, and discipline"
        backHref="/dashboard/admin"
      />
      <ApprovalMatrixPanel rules={rules} />
    </div>
  );
}
