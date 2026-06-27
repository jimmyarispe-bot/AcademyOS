import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getDemoEnvironments } from "@/lib/certification/demo-generator";
import { CertShell } from "@/components/certification/CertNav";
import { generateDemoAction } from "@/lib/certification/actions";

export default async function CertificationDemoPage() {
  await requirePagePermission(["certification.manage", "certification.admin"]);
  const supabase = await createAuthClient();
  const demos = await getDemoEnvironments(supabase);

  return (
    <CertShell title="Demo Environment" subtitle="One-click demo schools with students, finance, HR, and executive dashboards">
      <form action={generateDemoAction} className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <input name="demo_name" placeholder="Demo Academy" className="rounded-lg border px-3 py-2 text-sm" required />
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white">Generate demo</button>
      </form>
      <ul className="space-y-2 text-sm">
        {demos.map((d) => (
          <li key={d.id} className="rounded-xl border bg-white px-4 py-3">
            {d.demo_name} — {d.status}
          </li>
        ))}
        {!demos.length && <li className="text-slate-500">No demo environments yet.</li>}
      </ul>
    </CertShell>
  );
}
