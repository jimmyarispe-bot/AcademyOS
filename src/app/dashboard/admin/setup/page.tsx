import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { SetupWizardPanel } from "@/components/configuration/SetupWizardPanel";
import { loadConfigPage } from "@/lib/configuration/page-data";
import { getSetupSession, startSetupSession } from "@/lib/configuration/setup-wizard";

export default async function SetupWizardPage() {
  const { supabase, organizationId } = await loadConfigPage();
  let session = await getSetupSession(supabase, organizationId);
  if (!session) session = await startSetupSession(supabase, organizationId);

  return (
    <ConfigStudioShell title="Organization Setup Wizard" subtitle="Guided setup with save and resume">
      <SetupWizardPanel organizationId={organizationId} session={session} />
    </ConfigStudioShell>
  );
}
