import { PageHeader } from "@/components/ui/PageHeader";
import { UsersAssignmentsPanel } from "@/components/platform/admin/UsersAssignmentsPanel";
import { getAdminUsersDirectory } from "@/lib/platform/identity/queries";
import { getSchools } from "@/lib/finance/queries";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { hasIdentityPermission } from "@/lib/platform/identity/context";

export default async function UsersAdminPage() {
  const ctx = await requirePagePermission("users.view");
  const [users, schools] = await Promise.all([getAdminUsersDirectory(), getSchools()]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Users & Access"
        subtitle="Multi-school assignments, scopes, and impersonation"
        backHref="/dashboard/admin"
      />
      <UsersAssignmentsPanel
        users={users}
        schools={schools}
        canManage={hasIdentityPermission(ctx, "users.manage")}
        canImpersonate={hasIdentityPermission(ctx, "impersonate.users")}
      />
    </div>
  );
}
