import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getIncidents } from "@/lib/cloud-platform/incidents";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";
import { createIncidentAction, resolveIncidentAction } from "@/lib/cloud-platform/actions";

export default async function CloudIncidentsPage() {
  await requireCloudPermission(["cloud.admin", "cloud.operations"]);
  const supabase = await createAuthClient();
  const incidents = await getIncidents(supabase);

  return (
    <CloudShell title="Incident Management" subtitle="Outages, performance issues, root cause, and post-incident reviews">
      <form action={createIncidentAction} className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <input name="title" placeholder="Incident title" className="flex-1 rounded-lg border px-3 py-2 text-sm" required />
        <select name="severity" className="rounded-lg border px-3 py-2 text-sm">
          <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Open incident</button>
      </form>
      <CloudTable rows={incidents} columns={[
        { key: "incident_number", label: "#" }, { key: "title", label: "Title" },
        { key: "severity", label: "Severity" }, { key: "status", label: "Status" },
      ]} />
      {incidents.filter((i) => i.status !== "resolved").map((i) => (
        <form key={i.id} action={resolveIncidentAction} className="inline mr-2">
          <input type="hidden" name="incident_id" value={i.id} />
          <button type="submit" className="text-sm text-green-600 hover:underline">Resolve</button>
        </form>
      ))}
    </CloudShell>
  );
}
