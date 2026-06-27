import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getLatestMobileChecks } from "@/lib/certification/accessibility-engine";
import { CertShell } from "@/components/certification/CertNav";
import { CertTable } from "@/components/certification/CertPanels";

export default async function CertificationMobilePage() {
  await requirePagePermission(["certification.view", "certification.admin"]);
  const supabase = await createAuthClient();
  const checks = await getLatestMobileChecks(supabase);

  return (
    <CertShell title="Mobile Certification" subtitle="Desktop, laptop, tablet, iPhone, Android, foldables — portrait and landscape">
      <CertTable rows={checks} columns={[
        { key: "device_type", label: "Device" }, { key: "orientation", label: "Orientation" }, { key: "status", label: "Status" },
      ]} />
    </CertShell>
  );
}
