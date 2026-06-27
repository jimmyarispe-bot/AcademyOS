import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getParentLinkedStudentIds } from "@/lib/platform/identity/portal-access";
import { getPortalForms } from "@/lib/portal/forms";
import { PortalFormsPanel } from "@/components/portal/PortalFormsPanel";

export default async function PortalFormsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/forms");

  const supabase = await createAuthClient();
  const studentIds = await getParentLinkedStudentIds(supabase, sessionUser.id);
  const { data: students } = await supabase.from("students").select("id, first_name, last_name, family_id, school_id").in("id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  const schoolIds = [...new Set((students ?? []).map((s) => s.school_id))];
  const { templates, submissions } = await getPortalForms(supabase, schoolIds);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Family Forms Center</h1>
      <p className="text-slate-600">Re-enrollment, medical updates, agreements, and custom school forms with digital signatures.</p>
      <PortalFormsPanel templates={templates} submissions={submissions} students={students ?? []} />
    </div>
  );
}
