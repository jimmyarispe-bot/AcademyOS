import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm, ConfigJsonPreview } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";

export default async function FinanceConfigPage() {
  const { organizationId, config } = await loadConfigPage("finance");

  return (
    <ConfigStudioShell title="Finance Configuration" subtitle="Tuition models, billing, scholarships, and collections">
      <ConfigSectionForm
        sectionKey="finance"
        organizationId={organizationId}
        title="Finance policies"
        config={config}
        fields={[
          { name: "sibling_discount_pct", label: "Sibling discount %", type: "number" },
          { name: "late_fee_policy", label: "Late fee policy (JSON)", placeholder: '{"pct":5,"grace_days":10}' },
        ]}
      />
      <ConfigJsonPreview config={config} />
    </ConfigStudioShell>
  );
}
