import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getCustomerSuccessSnapshots } from "@/lib/cloud-platform/customer-success";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";

export default async function CloudCustomerSuccessPage() {
  await requireCloudPermission(["cloud.admin", "cloud.analytics", "cloud.support"]);
  const supabase = await createAuthClient();
  const snapshots = await getCustomerSuccessSnapshots(supabase);

  return (
    <CloudShell title="Customer Success" subtitle="Health scores, adoption, renewal probability, and risk indicators">
      <CloudTable rows={snapshots} columns={[
        { key: "health_score", label: "Health" }, { key: "platform_adoption_pct", label: "Adoption %" },
        { key: "renewal_probability_pct", label: "Renewal %" }, { key: "open_tickets", label: "Tickets" },
      ]} />
    </CloudShell>
  );
}
