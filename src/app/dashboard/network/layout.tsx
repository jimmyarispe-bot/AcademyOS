import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewIntelligenceNetwork } from "@/lib/intelligence-network/access";

export default async function IntelligenceNetworkLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewIntelligenceNetwork(ctx)) redirect("/dashboard");
  return children;
}
