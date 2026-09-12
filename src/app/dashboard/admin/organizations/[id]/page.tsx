import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getOrganizationDetail } from "@/lib/platform/identity/organizations";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { EmailLink } from "@/components/platform/contact/ContactLink";

export default async function OrganizationDetailAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("org.view");
  const { id } = await params;
  const supabase = await createAuthClient();
  const organization = await getOrganizationDetail(id, supabase);

  if (!organization) notFound();

  const { data: owner } = organization.ownerUserId
    ? await supabase
        .from("users")
        .select("id, email, full_name")
        .eq("id", organization.ownerUserId)
        .maybeSingle()
    : { data: null };

  const brandingEntries = Object.entries(organization.branding).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={organization.name}
        subtitle="Organization entity — isolated tenant boundary"
        backHref="/dashboard/admin/organizations"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Identity</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{organization.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Type</dt>
              <dd className="text-slate-800">{organization.orgType.replaceAll("_", " ")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="text-slate-800">{organization.status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Timezone</dt>
              <dd className="text-slate-800">{organization.timezone}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Slug</dt>
              <dd className="text-slate-800">{organization.slug}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Owner</h2>
          <p className="mt-3 text-sm font-medium text-slate-900">
            {owner?.full_name ?? "Unassigned"}
          </p>
          <p className="text-sm text-slate-500">
            {owner?.email ? (
              <EmailLink email={owner.email} />
            ) : (
              (organization.ownerUserId ?? "—")
            )}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Subscription</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Plan</dt>
              <dd className="text-slate-800">{organization.subscriptionPlanKey ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="text-slate-800">{organization.subscriptionStatus}</dd>
            </div>
          </dl>
          <Link
            href="/dashboard/admin/subscriptions"
            className="mt-4 inline-block text-sm font-medium text-brand-600"
          >
            Manage subscriptions →
          </Link>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Branding</h2>
        {brandingEntries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No branding configured on this organization.</p>
        ) : (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
            {brandingEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-slate-500">{key}</dt>
                <dd className="truncate text-slate-800">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
        <Link
          href="/dashboard/admin/branding"
          className="mt-4 inline-block text-sm font-medium text-brand-600"
        >
          Open branding studio →
        </Link>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Schools</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {organization.schools.map((school) => (
              <li key={school.id} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-900">{school.name}</span>
                <span className="text-slate-500">{school.timezone ?? "—"}</span>
              </li>
            ))}
            {organization.schools.length === 0 && (
              <li className="text-slate-500">No schools linked.</li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Users</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {organization.users.map((user) => (
              <li key={user.userId} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-slate-900">
                    {user.fullName ?? user.email ?? user.userId}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-slate-500">
                    {user.membershipRole}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {user.status}
                  {user.isPrimary ? " · primary" : ""}
                </p>
              </li>
            ))}
            {organization.users.length === 0 && (
              <li className="text-slate-500">No organization members.</li>
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Permissions</h2>
        <p className="mt-1 text-sm text-slate-500">
          Union of membership-scoped permission keys for this organization.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {organization.permissions.map((key) => (
            <span
              key={key}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {key}
            </span>
          ))}
          {organization.permissions.length === 0 && (
            <span className="text-sm text-slate-500">No membership permissions assigned.</span>
          )}
        </div>
      </section>
    </div>
  );
}
