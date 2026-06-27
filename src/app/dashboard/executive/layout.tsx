import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canAccessExecutiveIntelligence } from "@/lib/executive/access";
import { canViewEdi } from "@/lib/edi/access";
import { ExecutiveNav } from "@/components/executive/ExecutiveNav";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getIdentityContext();
  if (!ctx || (!canAccessExecutiveIntelligence(ctx) && !canViewEdi(ctx))) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Executive Intelligence"
        subtitle="Decision support — organizational health, forecasting, risk, and board reporting"
      />
      <ExecutiveNav />
      {children}
    </div>
  );
}
