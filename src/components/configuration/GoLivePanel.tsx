import type { GoLiveCheck } from "@/lib/configuration/types";
import { launchOrganizationAction } from "@/lib/configuration/actions";
import Link from "next/link";

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "green"
      ? "bg-emerald-500"
      : status === "yellow"
        ? "bg-amber-500"
        : status === "red"
          ? "bg-rose-500"
          : "bg-slate-300";
  return <span className={`inline-block h-3 w-3 rounded-full ${cls}`} />;
}

export function GoLivePanel({
  organizationId,
  checks,
  ready,
}: {
  organizationId: string;
  checks: GoLiveCheck[];
  ready: boolean;
}) {
  return (
    <div className="space-y-6">
      {ready ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Ready to launch</p>
          <p className="mt-2 text-3xl font-bold text-emerald-900">READY TO LAUNCH</p>
          <form action={launchOrganizationAction} className="mt-4">
            <input type="hidden" name="organization_id" value={organizationId} />
            <button type="submit" className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Launch organization
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Complete required checks before launch. Red items must be resolved.
        </div>
      )}

      <ul className="space-y-2">
        {checks.map((check) => (
          <li key={check.checkKey} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-start gap-3">
              <StatusDot status={check.status} />
              <div>
                <p className="font-medium">{check.title}</p>
                <p className="text-sm text-slate-500">{check.message}</p>
                {check.isRequired && <span className="text-xs text-slate-400">Required</span>}
              </div>
            </div>
            {check.resolveHref && check.status !== "green" && (
              <Link href={check.resolveHref} className="shrink-0 text-sm text-brand-600 hover:underline">
                Fix →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
