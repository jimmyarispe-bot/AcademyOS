import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewIntegrationHub } from "@/lib/integration-hub/access";

export default async function IntegrationHubLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewIntegrationHub(ctx)) redirect("/dashboard");
  return children;
}
