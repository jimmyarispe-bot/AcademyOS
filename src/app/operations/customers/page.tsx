import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsCustomersPage() {
  await requireOperationsPermission(["operations.view"]);
  const supabase = await createAuthClient();
  const customers = await getCustomers(supabase, 100);

  return (
    <OpsShell title="Customer Management" subtitle="All AcademyOS customers — health, risk, adoption, and subscription status">
      <OpsTable rows={customers} columns={[
        { key: "customer_name", label: "Customer" }, { key: "status", label: "Status" },
        { key: "health_score", label: "Health" }, { key: "risk_level", label: "Risk" },
        { key: "student_count", label: "Students" }, { key: "renewal_date", label: "Renewal" },
      ]} />
    </OpsShell>
  );
}
