import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getStaffNotifications } from "@/lib/admissions/communications/queries";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
