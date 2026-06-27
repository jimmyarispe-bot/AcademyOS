import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigStudioHub } from "@/components/configuration/ConfigStudioHub";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import Link from "next/link";

export default async function ConfigurationStudioPage() {
  await requirePagePermission(["configuration.view", "configuration.manage", "org.view"]);

  return (
    <ConfigStudioShell
      title="Configuration Studio"
      subtitle="Organization builder — configure AcademyOS without code. All settings stored in the database."
    >
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/admin/setup" className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
          Start setup wizard →
        </Link>
        <Link href="/dashboard/admin/go-live" className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
          Go-live center →
        </Link>
        <Link href="/api/configuration/export" className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
          Export config →
        </Link>
      </div>
      <ConfigStudioHub />
    </ConfigStudioShell>
  );
}
