import { PageHeader } from "@/components/ui/PageHeader";
import { StaffDirectoryPanel } from "@/components/platform/admin/StaffDirectoryPanel";
import { getStaffDirectoryEntries } from "@/lib/platform/identity/queries";
import { getSchools } from "@/lib/finance/queries";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";

export default async function StaffDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  await requirePagePermission("directory.view");
  const params = await searchParams;
  const schools = await getSchools();
  const entries = await getStaffDirectoryEntries(params.school);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Staff Directory"
        subtitle="Enterprise directory with roles, departments, and contact info"
        backHref="/dashboard/admin"
      />
      <div className="flex flex-wrap gap-2">
        <a
          href="/dashboard/admin/directory"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            !params.school ? "bg-brand-600 text-white" : "border border-slate-200 text-slate-600"
          }`}
        >
          All schools
        </a>
        {schools.map((s) => (
          <a
            key={s.id}
            href={`/dashboard/admin/directory?school=${s.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              params.school === s.id ? "bg-brand-600 text-white" : "border border-slate-200 text-slate-600"
            }`}
          >
            {s.name}
          </a>
        ))}
      </div>
      <StaffDirectoryPanel entries={entries} />
    </div>
  );
}
