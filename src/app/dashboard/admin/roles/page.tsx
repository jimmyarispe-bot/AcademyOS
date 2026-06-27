import { PageHeader } from "@/components/ui/PageHeader";
import { RolesPermissionsPanel } from "@/components/platform/admin/RolesPermissionsPanel";
import { getRolesWithPermissions } from "@/lib/platform/identity/queries";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";

export default async function RolesAdminPage() {
  await requirePagePermission("roles.view");
  const { roles, permissions, rolePermissions } = await getRolesWithPermissions();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Configurable RBAC with inheritance and custom roles"
        backHref="/dashboard/admin"
      />
      <RolesPermissionsPanel roles={roles} permissions={permissions} rolePermissions={rolePermissions} />
    </div>
  );
}
