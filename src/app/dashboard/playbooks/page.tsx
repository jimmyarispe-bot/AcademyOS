import { PageHeader } from "@/components/ui/PageHeader";
import { PlaybooksList } from "@/components/work/WorkLists";
import { canViewWork } from "@/lib/work/access";
import { getPlaybooks } from "@/lib/work/queries";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { redirect } from "next/navigation";

export default async function PlaybooksPage() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewWork(ctx)) redirect("/dashboard");

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    undefined;

  const supabase = await createAuthClient();
  const playbooks = await getPlaybooks(supabase, schoolId);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Playbooks"
        subtitle="Reusable operational playbooks — run to auto-create projects, tasks, deadlines, and integrations"
      />
      <PlaybooksList playbooks={playbooks} schoolId={schoolId} />
    </div>
  );
}
