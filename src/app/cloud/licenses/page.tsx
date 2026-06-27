import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getLicenses } from "@/lib/cloud-platform/licensing";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";
import { issueLicenseAction } from "@/lib/cloud-platform/actions";

export default async function CloudLicensesPage() {
  await requireCloudPermission(["cloud.admin", "cloud.sales"]);
  const supabase = await createAuthClient();
  const [licenses, customers] = await Promise.all([getLicenses(supabase), getCustomers(supabase)]);

  return (
    <CloudShell title="Licensing" subtitle="Module, student, staff, storage, and API limits">
      <form action={issueLicenseAction} className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <select name="customer_id" className="rounded-lg border px-3 py-2 text-sm">
          {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
        </select>
        <input type="hidden" name="modules" value='["admissions","sis","finance"]' />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Issue license</button>
      </form>
      <CloudTable rows={licenses} columns={[
        { key: "license_key", label: "Key" }, { key: "status", label: "Status" },
        { key: "student_limit", label: "Students" }, { key: "expires_at", label: "Expires" },
      ]} />
    </CloudShell>
  );
}
