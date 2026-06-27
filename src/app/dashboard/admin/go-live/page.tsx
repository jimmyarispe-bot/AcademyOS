import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { GoLivePanel } from "@/components/configuration/GoLivePanel";
import { loadConfigPage } from "@/lib/configuration/page-data";
import { getGoLiveSummary } from "@/lib/configuration/go-live";
import { importConfigPackageAction } from "@/lib/configuration/actions";

export default async function GoLivePage() {
  const { supabase, organizationId } = await loadConfigPage();
  const { checks, ready } = await getGoLiveSummary(supabase, organizationId);

  return (
    <ConfigStudioShell title="Go Live Center" subtitle="Validate configuration and launch your organization">
      <GoLivePanel organizationId={organizationId} checks={checks} ready={ready} />
      <form action={importConfigPackageAction} className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Import configuration package</h3>
        <input type="hidden" name="organization_id" value={organizationId} />
        <textarea name="package_json" rows={6} className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" placeholder='{"sections":[],"modules":[]}' />
        <button type="submit" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Import JSON package
        </button>
      </form>
    </ConfigStudioShell>
  );
}
