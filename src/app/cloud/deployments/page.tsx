import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getDeployments, getReleases } from "@/lib/cloud-platform/releases";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";
import { createDeploymentAction } from "@/lib/cloud-platform/actions";

export default async function CloudDeploymentsPage() {
  await requireCloudPermission(["cloud.admin", "cloud.operations", "cloud.engineering"]);
  const supabase = await createAuthClient();
  const [deployments, releases] = await Promise.all([getDeployments(supabase), getReleases(supabase)]);

  return (
    <CloudShell title="Deployment Center" subtitle="Production, staging, testing, rollback, and release approvals">
      <form action={createDeploymentAction} className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <select name="environment" className="rounded-lg border px-3 py-2 text-sm">
          <option value="production">Production</option><option value="staging">Staging</option><option value="testing">Testing</option>
        </select>
        <select name="release_id" className="rounded-lg border px-3 py-2 text-sm">
          <option value="">No release</option>
          {releases.map((r) => <option key={r.id} value={r.id}>{r.release_version}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Schedule deployment</button>
      </form>
      <CloudTable rows={deployments} columns={[
        { key: "environment", label: "Env" }, { key: "status", label: "Status" }, { key: "created_at", label: "Created" },
      ]} />
    </CloudShell>
  );
}
