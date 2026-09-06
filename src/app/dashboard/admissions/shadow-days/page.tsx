import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/PageHeader";
import { ShadowDaysPanel } from "@/components/admissions/ShadowDaysPanel";
import { listShadowDaysInProgress } from "@/lib/admissions/shadow-days";
import { hasPermission } from "@/lib/platform/identity/authorization-service";
import { getIdentityContext } from "@/lib/platform/identity/context";

export const metadata = {
  title: "Shadow days",
  description: "Children whose shadow days are booked and not yet finished",
};

export const dynamic = "force-dynamic";

export default async function ShadowDaysPage() {
  const identity = await getIdentityContext();
  if (!identity) redirect("/login");

  // Same shape as the decisions page: seeing needs admissions.view, acting
  // needs admissions.accept. Read-only beats a redirect that looks like a
  // broken link.
  if (!hasPermission(identity, "admissions.view")) {
    const roles = identity.roles?.length ? identity.roles.join(", ") : "none";
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Shadow days"
          subtitle="You do not have access to this page"
          backHref="/dashboard"
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            This page needs the <span className="font-mono">admissions.view</span> permission.
          </p>
          <p className="mt-1">
            The roles on your account are: <span className="font-mono">{roles}</span>
          </p>
        </div>
      </div>
    );
  }

  const result = await listShadowDaysInProgress();
  const canAct =
    hasPermission(identity, "admissions.accept") || hasPermission(identity, "admissions.manage");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Shadow days"
        subtitle="A child cannot be accepted until their shadow days are marked complete"
        backHref="/dashboard/admissions"
      />

      {"error" in result ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {result.error}
        </div>
      ) : (
        <>
          {!canAct ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              You can see these but not mark them complete — that needs the{" "}
              <span className="font-mono">admissions.accept</span> permission.
            </div>
          ) : null}
          <ShadowDaysPanel initial={result.cases} canAct={canAct} />
        </>
      )}
    </div>
  );
}
