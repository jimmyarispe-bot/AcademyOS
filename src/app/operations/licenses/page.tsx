import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getLicenses } from "@/lib/cloud-platform/licensing";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";

export default async function OperationsLicensesPage() {
  await requireOperationsPermission(["operations.billing"]);
  const supabase = await createAuthClient();
  const licenses = await getLicenses(supabase);

  return (
    <OpsShell title="License Management" subtitle="Licensed modules, limits, renewals, and feature entitlements">
      <OpsTable rows={licenses} columns={[
        { key: "license_key", label: "License" }, { key: "status", label: "Status" },
        { key: "student_limit", label: "Students" }, { key: "expires_at", label: "Expires" },
      ]} />
    </OpsShell>
  );
}
