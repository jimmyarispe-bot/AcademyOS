import Link from "next/link";
import { redirect } from "next/navigation";

import { TuitionPlanBuilder } from "@/components/finance/TuitionPlanBuilder";
import { loadPlanEditorContext } from "@/lib/finance/plan-editor";
import { hasPermission } from "@/lib/platform/identity/authorization-service";
import { getIdentityContext } from "@/lib/platform/identity/context";

export const dynamic = "force-dynamic";

export const metadata = { title: "Build a tuition plan · The JAG™" };

interface Props {
  params: Promise<{ studentId: string }>;
}

export default async function BuildPlanPage({ params }: Props) {
  const { studentId } = await params;

  const identity = await getIdentityContext();
  if (!identity) redirect("/login");

  // Seeing needs finance.view; saving needs finance.billing, enforced again
  // inside the action. Read-only beats a redirect that looks like a dead link.
  if (!hasPermission(identity, "finance.view") && !hasPermission(identity, "finance.billing")) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">Build a tuition plan</h1>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This page needs the <span className="font-mono">finance.view</span> permission.
        </div>
      </div>
    );
  }

  const ctx = await loadPlanEditorContext(studentId);

  if ("error" in ctx) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/dashboard/finance/schedules" className="text-sm text-slate-500 hover:text-slate-700">
          ‹ Payment Schedules
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Build a tuition plan</h1>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {ctx.error}
        </div>
      </div>
    );
  }

  const canSave = hasPermission(identity, "finance.billing");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/dashboard/finance/schedules" className="text-sm text-slate-500 hover:text-slate-700">
        ‹ Payment Schedules
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{ctx.studentName}</h1>
      <p className="mt-1 text-slate-500">
        {ctx.schoolName}
        {ctx.gradeLevel ? ` · ${ctx.gradeLevel.replace(/_/g, " ")}` : ""} · {ctx.schoolYearName}
      </p>

      {!canSave ? (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          You can see this but not save it — that needs the{" "}
          <span className="font-mono">finance.billing</span> permission.
        </div>
      ) : null}

      <div className="mt-6">
        <TuitionPlanBuilder ctx={ctx} canSave={canSave} />
      </div>
    </div>
  );
}
