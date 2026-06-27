import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { AiReadinessNotice } from "@/components/cloud-platform/CloudPanels";
import { saveWhiteLabelAction } from "@/lib/cloud-platform/actions";
import { CLOUD_EMPLOYEE_ROLES, CLOUD_AI_READINESS } from "@/lib/cloud-platform/types";

export default async function CloudSettingsPage() {
  await requireCloudPermission(["cloud.admin"]);
  const supabase = await createAuthClient();
  const customers = await getCustomers(supabase, 20);

  return (
    <CloudShell title="Cloud Settings" subtitle="White-label, employee roles, and platform configuration">
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">White-label</h2>
        <form action={saveWhiteLabelAction} className="space-y-3">
          <select name="customer_id" className="w-full rounded-lg border px-3 py-2 text-sm">
            {customers.filter((c) => c.is_white_label).map((c) => (
              <option key={c.id} value={c.id}>{c.customer_name}</option>
            ))}
            {customers.filter((c) => c.is_white_label).length === 0 && customers.map((c) => (
              <option key={c.id} value={c.id}>{c.customer_name}</option>
            ))}
          </select>
          <input name="primary_color" placeholder="#6366f1" className="w-full rounded-lg border px-3 py-2 text-sm" />
          <input name="custom_domain" placeholder="school.example.com" className="w-full rounded-lg border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Save white-label</button>
        </form>
      </section>
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-2 font-semibold">Employee roles</h2>
        <p className="text-sm text-slate-600">{CLOUD_EMPLOYEE_ROLES.join(", ")}</p>
      </section>
      <AiReadinessNotice />
      <ul className="text-sm text-slate-600">
        {CLOUD_AI_READINESS.map((c) => <li key={c}>→ {c.replace(/_/g, " ")}</li>)}
      </ul>
    </CloudShell>
  );
}
