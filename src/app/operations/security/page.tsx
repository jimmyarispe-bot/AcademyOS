import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getLatestSecuritySnapshot } from "@/lib/operations-platform/security";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsMetricsGrid } from "@/components/operations-platform/OpsPanels";

export default async function OperationsSecurityPage() {
  await requireOperationsPermission(["operations.security"]);
  const supabase = await createAuthClient();
  const snapshot = await getLatestSecuritySnapshot(supabase);

  return (
    <OpsShell title="Security Operations Center" subtitle="Threat detection, suspicious logins, permission escalation, credential rotation, API abuse, DDoS readiness, audit">
      {snapshot && (
        <OpsMetricsGrid metrics={[
          ["Security Score", `${snapshot.security_score}%`], ["Threat Alerts", snapshot.threat_alerts],
          ["Suspicious Logins", snapshot.suspicious_logins], ["Permission Escalations", snapshot.permission_escalations],
          ["Credential Rotations Due", snapshot.credential_rotations_due], ["API Abuse Events", snapshot.api_abuse_events],
          ["DDoS Readiness", `${snapshot.ddos_readiness_pct}%`], ["Encryption Health", `${snapshot.encryption_health_pct}%`],
        ]} />
      )}
    </OpsShell>
  );
}
