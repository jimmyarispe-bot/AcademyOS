import { redirect } from "next/navigation";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { requireCertificationAccess } from "@/lib/certification/access";
import { createAuthClient } from "@/lib/supabase/server-auth";

export default async function CertificationLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getIdentityContext();
  if (!ctx) redirect("/login");

  const supabase = await createAuthClient();
  if (!(await requireCertificationAccess(supabase, ctx))) redirect("/dashboard");

  return children;
}
