import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm, ConfigJsonPreview } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";

export default async function AcademicConfigPage() {
  const { organizationId, config } = await loadConfigPage("academic");

  return (
    <ConfigStudioShell title="Academic Configuration" subtitle="Grade levels, subjects, grading, attendance, and promotion rules">
      <ConfigSectionForm
        sectionKey="academic"
        organizationId={organizationId}
        title="Academic settings"
        config={config}
        fields={[
          { name: "attendance_policies", label: "Minimum attendance % (JSON)", placeholder: '{"minimum_pct":90}' },
        ]}
      />
      <ConfigJsonPreview config={config} />
    </ConfigStudioShell>
  );
}
