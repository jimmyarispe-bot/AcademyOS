import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getLatestAccessibilityChecks } from "@/lib/certification/accessibility-engine";
import { CertShell } from "@/components/certification/CertNav";
import { CertTable } from "@/components/certification/CertPanels";

export default async function CertificationAccessibilityPage() {
  await requirePagePermission(["certification.view", "certification.admin"]);
  const supabase = await createAuthClient();
  const checks = await getLatestAccessibilityChecks(supabase);

  return (
    <CertShell title="Accessibility Certification" subtitle="WCAG 2.2 AA — keyboard, screen readers, contrast, focus, ARIA">
      <CertTable rows={checks} columns={[
        { key: "wcag_criterion", label: "WCAG" }, { key: "check_name", label: "Check" }, { key: "status", label: "Status" },
      ]} />
    </CertShell>
  );
}
