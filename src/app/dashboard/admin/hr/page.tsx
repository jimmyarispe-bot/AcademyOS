import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm, ConfigJsonPreview } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";

export default async function HrConfigPage() {
  const { organizationId, config } = await loadConfigPage("hr");

  return (
    <ConfigStudioShell title="HR Configuration" subtitle="Departments, positions, leave, payroll calendars, and certifications">
      <ConfigSectionForm
        sectionKey="hr"
        organizationId={organizationId}
        title="Workforce policies"
        config={config}
        fields={[
          { name: "leave_policies", label: "Leave policies (JSON)", placeholder: '{"pto_days":10}' },
          { name: "certification_rules", label: "Certification rules (JSON)", placeholder: '{"renewal_reminder_days":90}' },
        ]}
      />
      <ConfigJsonPreview config={config} />
    </ConfigStudioShell>
  );
}
