import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm, ConfigJsonPreview } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";
import Link from "next/link";

export default async function WorkflowsConfigPage() {
  const { organizationId, config } = await loadConfigPage("workflows");

  return (
    <ConfigStudioShell title="Workflow Studio" subtitle="Automation, approvals, deadlines, escalations, and Mission Control rules">
      <ConfigSectionForm sectionKey="workflows" organizationId={organizationId} title="Workflow rules" config={config} fields={[]} />
      <ConfigJsonPreview config={config} />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/automation/marketplace" className="text-brand-600 hover:underline">Workflow marketplace →</Link>
        <Link href="/dashboard/compliance" className="text-brand-600 hover:underline">Compliance automations →</Link>
      </div>
    </ConfigStudioShell>
  );
}
