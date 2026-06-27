import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getCustomerHealthProfiles } from "@/lib/operations-platform/customer-success";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function CustomerHealthPage() {
  await requireOperationsPermission(["operations.view", "operations.support"]);
  const supabase = await createAuthClient();
  const profiles = await getCustomerHealthProfiles(supabase);

  return (
    <OpsShell title="Customer Success Center" subtitle="Health, risk, adoption, training, implementation, support satisfaction, renewal probability, expansion opportunity">
      <OpsTable rows={profiles} columns={[
        { key: "customer_id", label: "Customer" }, { key: "health_score", label: "Health" },
        { key: "risk_score", label: "Risk" }, { key: "adoption_score", label: "Adoption" },
        { key: "training_score", label: "Training" }, { key: "implementation_progress_pct", label: "Implementation" },
        { key: "renewal_probability_pct", label: "Renewal %" }, { key: "expansion_opportunity_pct", label: "Expansion %" },
      ]} />
    </OpsShell>
  );
}
