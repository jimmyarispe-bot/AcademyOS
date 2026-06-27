import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm, ConfigJsonPreview } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";

export default async function AdmissionsConfigPage() {
  const { organizationId, config } = await loadConfigPage("admissions");

  return (
    <ConfigStudioShell title="Admissions Configuration" subtitle="Forms, workflows, tours, interviews, and automation">
      <ConfigSectionForm
        sectionKey="admissions"
        organizationId={organizationId}
        title="Admissions pipeline"
        config={config}
        fields={[
          { name: "interview_process", label: "Interview enabled (JSON)", placeholder: '{"enabled":true}' },
          { name: "tour_process", label: "Tour enabled (JSON)", placeholder: '{"enabled":true}' },
        ]}
      />
      <ConfigJsonPreview config={config} />
    </ConfigStudioShell>
  );
}
