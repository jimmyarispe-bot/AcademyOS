import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canAccessCloudConsole } from "@/lib/cloud-platform/access";

export const metadata = {
  title: "AcademyOS Cloud Console",
  description: "Commercial SaaS platform operations — AcademyOS employees only",
  manifest: "/cloud-manifest.json",
};

export default async function CloudLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getIdentityContext();
  if (!ctx || !canAccessCloudConsole(ctx)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}
