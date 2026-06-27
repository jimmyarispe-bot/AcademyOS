import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewDataPlatform } from "@/lib/enterprise-data/access";

export default async function DataPlatformLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewDataPlatform(ctx)) redirect("/dashboard");

  return children;
}
