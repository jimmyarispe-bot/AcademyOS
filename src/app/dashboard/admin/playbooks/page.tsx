import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";
import Link from "next/link";

export default async function PlaybooksConfigPage() {
  const { organizationId, config } = await loadConfigPage("playbooks");

  return (
    <ConfigStudioShell title="Playbooks" subtitle="Configure operational playbooks">
      <ConfigSectionForm sectionKey="playbooks" organizationId={organizationId} title="Playbook settings" config={config} fields={[{ name: "enabled", label: "Playbooks enabled", placeholder: "true" }]} />
      <Link href="/dashboard/playbooks" className="text-sm text-brand-600 hover:underline">Open playbooks →</Link>
    </ConfigStudioShell>
  );
}
