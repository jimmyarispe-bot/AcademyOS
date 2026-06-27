import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getPortalNotifications } from "@/lib/portal/notifications";
import { PortalNotificationsList } from "@/components/portal/PortalNotificationsList";

export default async function PortalNotificationsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/notifications");

  const supabase = await createAuthClient();
  const notifications = await getPortalNotifications(supabase, sessionUser.id);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Notifications</h1>
      <p className="text-slate-600">Messages, attendance, academic updates, financial reminders, meetings, and school announcements.</p>
      <PortalNotificationsList notifications={notifications} />
    </div>
  );
}
