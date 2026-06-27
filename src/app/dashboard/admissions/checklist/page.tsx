import { PageHeader } from "@/components/ui/PageHeader";
import { ChecklistSettingsPanel } from "@/components/admissions/ChecklistSettingsPanel";
import { getChecklistTemplate } from "@/lib/admissions/checklist";
import { getSchools } from "@/lib/admissions/queries";

interface ChecklistSettingsPageProps {
  searchParams: Promise<{ school?: string }>;
}

export default async function ChecklistSettingsPage({ searchParams }: ChecklistSettingsPageProps) {
  const { school: schoolId } = await searchParams;
  const schools = await getSchools();
  const selectedSchoolId = schoolId ?? schools[0]?.id;
  const template = selectedSchoolId ? await getChecklistTemplate(selectedSchoolId) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Admissions Checklist Settings"
        subtitle="Customize required items per school"
        backHref="/dashboard/admissions"
      />
      <ChecklistSettingsPanel
        schools={schools}
        selectedSchoolId={selectedSchoolId ?? ""}
        template={template}
      />
    </div>
  );
}
