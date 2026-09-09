import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { hasPermission } from "@/lib/platform/identity/authorization-service";
import { formatCount } from "@/lib/format";
import { getFamiliesWaiting, STALE_AFTER_DAYS } from "@/lib/admissions/waiting";

export const metadata = {
  title: "Families waiting on us",
  description: "Every open admissions task, by campus, longest wait first",
};

export const dynamic = "force-dynamic";

interface WaitingPageProps {
  searchParams: Promise<{ campus?: string }>;
}

/**
 * The call list. Server-rendered, filtered through the URL rather than client
 * state, so a campus view is a link somebody can bookmark or send to whoever is
 * making the calls.
 */
export default async function AdmissionsWaitingPage({ searchParams }: WaitingPageProps) {
  const identity = await getIdentityContext();
  if (!identity) redirect("/login");

  if (!hasPermission(identity, "admissions.view")) {
    const roles = identity.roles?.length ? identity.roles.join(", ") : "none";
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Families waiting on us"
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

  const { campus: campusParam } = await searchParams;
  const list = await getFamiliesWaiting();

  if (list.unavailable) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Families waiting on us"
          subtitle="Every open admissions task, longest wait first"
          backHref="/dashboard/admissions"
        />
        {/* The reason, not a zero. A queue that reads "0 families" when the read
            was refused is exactly the failure this screen exists to end. */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {list.unavailable}
        </div>
      </div>
    );
  }

  const selected = list.campuses.find((c) => c.schoolId === campusParam);
  const families = selected
    ? list.families.filter((f) => f.schoolId === selected.schoolId)
    : list.families;

  const overdue = families.filter((f) => f.daysOverdue != null && f.daysOverdue > 0).length;
  const stale = families.filter(
    (f) => f.daysOverdue != null && f.daysOverdue > STALE_AFTER_DAYS
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Families waiting on us"
        subtitle="Every open admissions task, longest wait first. The top of this list is the oldest neglect, not the newest inquiry."
        backHref="/dashboard/admissions"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/admissions/waiting"
          className={
            selected
              ? "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              : "rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
          }
        >
          All campuses · {formatCount(list.total)}
        </Link>
        {list.campuses.map((c) => (
          <Link
            key={c.schoolId}
            href={`/dashboard/admissions/waiting?campus=${c.schoolId}`}
            className={
              selected?.schoolId === c.schoolId
                ? "rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
                : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            {c.campus} · {formatCount(c.waiting)}
          </Link>
        ))}
      </div>

      {families.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Nobody is waiting here. Every family in this view has a next step.
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{formatCount(families.length)}</span>{" "}
            {families.length === 1 ? "family" : "families"} waiting
            {overdue > 0 ? (
              <>
                {" · "}
                <span className="font-semibold text-amber-700">{formatCount(overdue)}</span> past due
              </>
            ) : null}
            {stale > 0 ? (
              <>
                {" · "}
                <span className="font-semibold text-rose-700">{formatCount(stale)}</span> waiting more
                than {STALE_AFTER_DAYS} days
              </>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Waiting</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Campus</th>
                  <th className="px-4 py-3">Parent</th>
                  <th className="px-4 py-3">Next step</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {families.map((f) => (
                  <tr key={f.taskId} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      {f.daysOverdue == null ? (
                        <span className="text-slate-400">no date</span>
                      ) : f.daysOverdue > STALE_AFTER_DAYS ? (
                        <span className="font-semibold text-rose-700">{f.daysOverdue} days</span>
                      ) : f.daysOverdue > 0 ? (
                        <span className="font-semibold text-amber-700">{f.daysOverdue} days</span>
                      ) : (
                        <span className="text-slate-500">due {f.dueDate}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{f.studentName}</div>
                      <div className="text-xs text-slate-500">
                        {f.applyingForGrade ? `${f.applyingForGrade} · ` : ""}
                        {f.leadStage.replace(/_/g, " ")}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{f.campus}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900">{f.guardianName ?? "—"}</div>
                      {f.guardianEmail ? (
                        <div className="text-xs">
                          <a
                            className="text-brand-600 hover:underline"
                            href={`mailto:${f.guardianEmail}`}
                          >
                            {f.guardianEmail}
                          </a>
                        </div>
                      ) : null}
                      {f.guardianPhone ? (
                        <div className="text-xs">
                          <a className="text-brand-600 hover:underline" href={`tel:${f.guardianPhone}`}>
                            {f.guardianPhone}
                          </a>
                        </div>
                      ) : null}
                      {!f.guardianEmail && !f.guardianPhone ? (
                        <div className="text-xs text-rose-600">no contact details on file</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{f.taskName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={f.caseHref}
                        className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        Open case
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
