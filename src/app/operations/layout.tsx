import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canAccessOperationsCenter } from "@/lib/operations-platform/access";

export const metadata = {
  title: "AcademyOS Operations Center",
  description: "Enterprise operations and SaaS management — AcademyOS as a business",
  manifest: "/operations-manifest.json",
};

export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getIdentityContext();
  if (!ctx || !canAccessOperationsCenter(ctx)) redirect("/dashboard");
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
