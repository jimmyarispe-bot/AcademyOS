import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getSessionUser } from "@/lib/auth/session";
import { listGuardianInviteCandidates } from "@/lib/portal/parent-invites";
import { ParentInviteList } from "@/components/admin/ParentInviteList";

interface PageProps {
  searchParams: Promise<{ school?: string }>;
}

/**
 * Inviting parents into JAG, one campus at a time.
 *
 * There is no cross-campus view and no "invite everyone" button. The difference
 * between sending three emails and sending ninety-four should be work, not a
 * default — and a campus is the unit a person can actually hold in their head
 * while deciding.
 *
 * Route authorisation is handled by the dashboard layout. The send itself is
 * gated on `users.manage` inside createManagedUser, which is the check that
 * matters because it is the one closest to the thing being done.
 */
export default async function ParentInvitesPage({ searchParams }: PageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/dashboard/admin/parent-invites");

  const { school } = await searchParams;
  const supabase = await createAuthClient();

  const { data: schools, error } = await supabase
    .from("schools")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("[parent-invites] schools", error.message);
  }

  const schoolList = schools ?? [];
  const selected = schoolList.find((s) => s.id === school) ?? null;
  const rows = selected ? await listGuardianInviteCandidates(selected.id) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Invite parents
        </h1>
        <p className="mt-1 text-slate-600">
          Creates a JAG account and emails the family a link to set their own
          password. Once they do, they can see and correct the details we hold.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {schoolList.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/admin/parent-invites?school=${s.id}`}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              selected?.id === s.id
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {s.name}
          </Link>
        ))}
      </nav>

      {!selected ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          Choose a campus to see who can be invited.
        </p>
      ) : (
        <ParentInviteList
          schoolId={selected.id}
          schoolName={selected.name}
          rows={rows.map((r) => ({
            guardianId: r.guardianId,
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email,
            familyName: r.familyName,
            needsConfirmation: r.needsConfirmation,
            skip: r.skip,
          }))}
        />
      )}
    </div>
  );
}
