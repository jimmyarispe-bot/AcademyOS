import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getDeploymentRollouts, getCloudDeployments } from "@/lib/operations-platform/deployments";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";
import { createDeploymentAction } from "@/lib/operations-platform/actions";

export default async function OperationsDeploymentsPage() {
  await requireOperationsPermission(["operations.manage"]);
  const supabase = await createAuthClient();
  const [rollouts, deployments] = await Promise.all([getDeploymentRollouts(supabase), getCloudDeployments(supabase)]);

  return (
    <OpsShell title="Deployment Center" subtitle="Release history, rollback, blue/green, canary, feature flags, regional rollout, maintenance windows">
      <form action={createDeploymentAction} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <input name="release_version" placeholder="Release version" className="rounded-lg border px-3 py-2 text-sm" required />
        <select name="strategy" className="rounded-lg border px-3 py-2 text-sm">
          <option value="rolling">Rolling</option><option value="blue_green">Blue/Green</option>
          <option value="canary">Canary</option><option value="regional">Regional</option>
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Deploy</button>
      </form>
      <h2 className="font-semibold">Rollouts</h2>
      <OpsTable rows={rollouts} columns={[
        { key: "release_version", label: "Release" }, { key: "deployment_strategy", label: "Strategy" },
        { key: "status", label: "Status" }, { key: "started_at", label: "Started" },
      ]} />
      <h2 className="font-semibold">Cloud Deployments</h2>
      <OpsTable rows={deployments} columns={[
        { key: "environment", label: "Env" }, { key: "status", label: "Status" },
        { key: "started_at", label: "Started" }, { key: "completed_at", label: "Completed" },
      ]} />
    </OpsShell>
  );
}
