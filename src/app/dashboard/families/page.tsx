import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { IntelligenceLink } from "@/components/ui/IntelligenceLink";
import { FamilyDashboard } from "@/components/families/FamilyDashboard";
import { getIdentityContext } from "@/lib/platform/identity/context";
import {
  canManageFamilyLifecycle,
  canViewFamilies,
  listFamiliesForDashboard,
  normalizeStatusFilter,
  type FamilySortKey,
} from "@/lib/families";

interface FamiliesPageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}

export default async function FamiliesPage({ searchParams }: FamiliesPageProps) {
  const identity = await getIdentityContext();
  if (!canViewFamilies(identity)) {
    redirect("/dashboard/students");
  }

  const sp = await searchParams;
  const status = normalizeStatusFilter(sp.status);
  const sort = (["family_name", "status", "last_activity", "student_count"].includes(sp.sort ?? "")
    ? sp.sort
    : "family_name") as FamilySortKey;
  const sortDir = sp.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const result = await listFamiliesForDashboard({
    status,
    search: sp.search ?? "",
    sort,
    sortDir,
    page,
    pageSize: 25,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Families"
        subtitle="Households, guardians, siblings, billing, and communications"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/students?view=add"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Add student
            </Link>
            <Link
              href="/dashboard/students/import"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Bulk import
            </Link>
          </div>
        }
      />
      <IntelligenceLink
        title="Which families carry the revenue?"
        description="Family Analytics reads billing and the QuickBooks books together — what each household is billed, what has arrived, and where the balances sit."
        href="/dashboard/finance/intelligence?view=families"
        linkLabel="Open Family Analytics"
      />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading families…</p>}>
        <FamilyDashboard
          rows={result.rows}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          statusFilter={status}
          search={sp.search ?? ""}
          sort={sort}
          sortDir={sortDir}
          canManageLifecycle={canManageFamilyLifecycle(identity)}
        />
      </Suspense>
    </div>
  );
}
