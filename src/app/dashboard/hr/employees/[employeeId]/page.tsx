import { notFound, redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { canAccessHrAdmin } from "@/lib/hr/access";
import { getEmployeeProfile } from "@/lib/hr/employee-profile";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { EmployeeProfilePanel } from "@/components/hr/EmployeeProfilePanel";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const ctx = await getIdentityContext();
  if (!ctx || !canAccessHrAdmin(ctx)) redirect("/dashboard");

  const { employeeId } = await params;
  const supabase = await createAuthClient();
  const profile = await getEmployeeProfile(supabase, employeeId);
  if (!profile) notFound();

  return <EmployeeProfilePanel profile={profile as Parameters<typeof EmployeeProfilePanel>[0]["profile"]} />;
}
