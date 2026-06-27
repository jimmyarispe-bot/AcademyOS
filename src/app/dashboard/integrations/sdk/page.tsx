import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getSdkPackages } from "@/lib/integration-hub/sdk-generator";
import { IntHubShell } from "@/components/integration-hub/IntHubNav";
import { IntHubTable } from "@/components/integration-hub/IntHubPanels";

export default async function IntegrationSdkPage() {
  await requirePagePermission(["developer.portal", "integration.view"]);
  const supabase = await createAuthClient();
  const packages = await getSdkPackages(supabase);

  return (
    <IntHubShell title="SDK Downloads" subtitle="TypeScript, JavaScript, Python, .NET, Java, PHP — REST + OAuth 2.0 + webhooks">
      <IntHubTable rows={packages} columns={[
        { key: "language", label: "Language" }, { key: "package_name", label: "Package" },
        { key: "latest_version", label: "Version" }, { key: "architecture_notes", label: "Architecture" },
      ]} />
    </IntHubShell>
  );
}
