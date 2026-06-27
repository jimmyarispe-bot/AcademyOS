import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getParentLinkedStudentIds } from "@/lib/platform/identity/portal-access";
import { getParentConferenceCenter } from "@/lib/portal/conferences";
import { PortalConferencesPanel } from "@/components/portal/PortalConferencesPanel";

export default async function PortalConferencesPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/conferences");

  const supabase = await createAuthClient();
  const studentIds = await getParentLinkedStudentIds(supabase, sessionUser.id);
  const { data: students } = await supabase.from("students").select("id, first_name, last_name").in("id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  const { meetings, requests } = await getParentConferenceCenter(supabase, studentIds);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Parent Conference Center</h1>
      <p className="text-slate-600">Request conferences, accept invitations, and review meeting notes synced with Scheduling.</p>
      <PortalConferencesPanel meetings={meetings} requests={requests} students={students ?? []} />
    </div>
  );
}
