import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewIntelligencePlatform } from "@/lib/intelligence-platform/access";

export default async function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewIntelligencePlatform(ctx)) redirect("/dashboard");

  return children;
}
