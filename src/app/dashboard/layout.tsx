import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { redirectIfPasswordResetRequired } from "@/lib/auth/must-reset-password";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getStaffNotifications } from "@/lib/admissions/communications/queries";
import { createAuthClient } from "@/lib/supabase/server-auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  redirectIfPasswordResetRequired(user, "/dashboard");

  const ctx = await getIdentityContext();

  if (!ctx) {
    redirect("/login");
  }

  const notifications = await getStaffNotifications(ctx.id);

  return (
    <DashboardShell
      fullName={ctx.fullName}
      roleLabel={ctx.roleLabel}
      notifications={notifications}
      impersonation={ctx.impersonation}
    >
      {children}
    </DashboardShell>
  );
}
