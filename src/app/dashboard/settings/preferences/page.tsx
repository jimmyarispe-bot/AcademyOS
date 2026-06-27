import { PageHeader } from "@/components/ui/PageHeader";
import { UserPreferencesPanel } from "@/components/platform/admin/UserPreferencesPanel";
import { requireAuthenticatedIdentity } from "@/lib/platform/identity/page-guard";

export default async function UserPreferencesPage() {
  const ctx = await requireAuthenticatedIdentity();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="My Preferences"
        subtitle="Dashboard layout, notifications, timezone, theme, and Mission Control widgets"
        backHref="/dashboard"
      />
      <UserPreferencesPanel preferences={ctx.preferences} />
    </div>
  );
}
