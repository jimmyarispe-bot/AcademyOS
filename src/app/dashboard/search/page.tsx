import { PageHeader } from "@/components/ui/PageHeader";
import { GlobalSearchPanel } from "@/components/platform/admin/GlobalSearchPanel";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";

export default async function GlobalSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePagePermission("search.global");
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Global Search"
        subtitle="Permission-filtered search across authorized records"
        backHref="/dashboard"
      />
      <GlobalSearchPanel initialQuery={params.q ?? ""} />
    </div>
  );
}
