import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import {
  canAccessParentPortal,
  canAccessStudentPortal,
  getParentLinkedStudentIds,
  getStudentSelfId,
} from "@/lib/platform/identity/portal-access";
import { getUnreadNotificationCount } from "@/lib/portal/notifications";
import { PortalShell } from "@/components/portal/PortalShell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal");

  const supabase = await createAuthClient();
  const [isParent, isStudent, studentIds, selfId, unread] = await Promise.all([
    canAccessParentPortal(supabase, sessionUser.id),
    canAccessStudentPortal(supabase, sessionUser.id),
    getParentLinkedStudentIds(supabase, sessionUser.id),
    getStudentSelfId(supabase, sessionUser.id),
    getUnreadNotificationCount(supabase, sessionUser.id),
  ]);

  if (!isParent && !isStudent && studentIds.length === 0 && !selfId) {
    redirect("/apply/portal");
  }

  const mode = isStudent && !isParent && !studentIds.length ? "student" : "parent";

  let students: { id: string; first_name: string; last_name: string }[] = [];
  if (studentIds.length) {
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .in("id", studentIds);
    students = data ?? [];
  }

  return (
    <PortalShell
      userEmail={sessionUser.email}
      mode={mode}
      students={students}
      unreadNotifications={unread}
    >
      {children}
    </PortalShell>
  );
}
