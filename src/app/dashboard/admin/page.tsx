import { PageHeader } from "@/components/ui/PageHeader";
import { AdminHub } from "@/components/platform/admin/AdminHub";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";

export default async function AdminHubPage() {
  const ctx = await requirePagePermission(["org.view", "users.view", "roles.view", "security.view"]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Administration"
        subtitle="Enterprise identity, organizations, permissions, and security"
        backHref="/dashboard"
      />
      <AdminHub permissions={ctx.permissions} />
    </div>
  );
}
