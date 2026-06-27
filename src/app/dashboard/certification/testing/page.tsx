import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getLatestWorkflowTests } from "@/lib/certification/testing-engine";
import { CertShell } from "@/components/certification/CertNav";
import { CertTable } from "@/components/certification/CertPanels";

export default async function CertificationTestingPage() {
  await requirePagePermission(["certification.view", "certification.manage", "certification.admin"]);
  const supabase = await createAuthClient();
  const tests = await getLatestWorkflowTests(supabase);

  return (
    <CertShell title="End-to-End Validation" subtitle="Admissions through Cloud Platform — pass, warning, failure, execution time, errors, and evidence">
      <CertTable rows={tests} columns={[
        { key: "workflow_name", label: "Workflow" },
        { key: "status", label: "Status" },
        { key: "execution_time_ms", label: "Time (ms)" },
        { key: "message", label: "Evidence" },
        { key: "errors", label: "Errors" },
        { key: "last_success_at", label: "Last Success" },
      ]} />
    </CertShell>
  );
}
