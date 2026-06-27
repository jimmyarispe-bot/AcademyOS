import { PageHeader } from "@/components/ui/PageHeader";
import { SchoolConfigPanel } from "@/components/platform/admin/SchoolConfigPanel";
import { getSchoolConfiguration } from "@/lib/platform/identity/org";
import { getSchools } from "@/lib/finance/queries";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";

export default async function SchoolConfigAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  await requirePagePermission("school.configure");
  const params = await searchParams;
  const schools = await getSchools();
  const selectedSchoolId = params.school ?? schools[0]?.id ?? "";
  const config = selectedSchoolId ? await getSchoolConfiguration(selectedSchoolId) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="School Configuration"
        subtitle="Branding, colors, and module settings per school"
        backHref="/dashboard/admin"
      />
      {selectedSchoolId && (
        <SchoolConfigPanel
          schools={schools}
          selectedSchoolId={selectedSchoolId}
          branding={config?.branding ?? null}
          settingsConfig={(config?.settings?.config as Record<string, unknown>) ?? {}}
        />
      )}
    </div>
  );
}
