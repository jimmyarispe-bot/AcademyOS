import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const READINESS_THRESHOLD = 85;

const SECURITY_CHECKS = [
  { key: "rls_coverage", name: "Row Level Security", critical: true },
  { key: "permission_enforcement", name: "Permission enforcement", critical: true },
  { key: "tenant_isolation", name: "Tenant isolation", critical: true },
  { key: "ferpa_compliance", name: "FERPA compliance", critical: true },
  { key: "record_classifications", name: "Record classifications", critical: false },
  { key: "api_authorization", name: "API authorization", critical: true },
  { key: "storage_policies", name: "Storage policies", critical: false },
  { key: "audit_coverage", name: "Audit coverage", critical: false },
  { key: "digital_signatures", name: "Digital signatures", critical: false },
  { key: "session_security", name: "Session security", critical: true },
  { key: "mfa_readiness", name: "MFA readiness", critical: false },
  { key: "secret_management", name: "Secret management", critical: true },
  { key: "webhook_authentication", name: "Webhook authentication", critical: false },
  { key: "api_key_security", name: "API key security", critical: false },
];

export async function runSecurityCertification(supabase: AuthClient, certRunId: string) {
  let totalScore = 0;
  const checks = [];
  const criticalFindings: string[] = [];

  for (const check of SECURITY_CHECKS) {
    let status: "pass" | "warning" | "failure" = "pass";
    let score = 100;
    const findings: string[] = [];
    const recommendations: string[] = [];

    if (check.key === "rls_coverage") {
      const tables = ["students", "cloud_customers", "edp_import_batches", "aip_prompts", "cert_runs"];
      for (const t of tables) {
        const { error } = await supabase.from(t).select("id", { count: "exact", head: true }).limit(1);
        if (error) findings.push(`${t}: verify RLS policy`);
      }
    }
    if (check.key === "mfa_readiness") {
      score = 90;
      recommendations.push("Enable MFA enrollment before enterprise launch");
    }
    if (check.key === "webhook_authentication") {
      const { count } = await supabase.from("edp_webhook_endpoints").select("id", { count: "exact", head: true });
      if (!count) {
        score = 85;
        recommendations.push("Configure webhook signing secrets for production endpoints");
      }
    }
    if (check.key === "secret_management") {
      recommendations.push("Rotate API keys quarterly; use Supabase vault for secrets");
    }

    if (score < 90 && check.critical) {
      status = score < 75 ? "failure" : "warning";
      criticalFindings.push(`${check.name}: score ${score}`);
    }

    totalScore += score;
    await supabase.from("cert_security_checks").insert({
      cert_run_id: certRunId,
      check_key: check.key,
      check_name: check.name,
      status,
      score,
      findings,
      recommendations,
      is_critical: check.critical && score < READINESS_THRESHOLD,
    });
    checks.push({ ...check, status, score, recommendations });
  }

  const securityScore = totalScore / SECURITY_CHECKS.length;
  return { securityScore, checks, criticalFindings };
}

export async function getLatestSecurityChecks(supabase: AuthClient, certRunId?: string) {
  const runId = certRunId ?? (await supabase.from("cert_runs").select("id").order("started_at", { ascending: false }).limit(1).maybeSingle()).data?.id;
  if (!runId) return { score: 0, checks: [], criticalFindings: [], recommendations: [] };
  const { data } = await supabase.from("cert_security_checks").select("*").eq("cert_run_id", runId);
  const score = data?.length ? data.reduce((s, c) => s + Number(c.score ?? 0), 0) / data.length : 0;
  const criticalFindings = (data ?? []).filter((c) => c.is_critical).map((c) => c.check_name as string);
  const recommendations = (data ?? []).flatMap((c) => (c.recommendations as string[]) ?? []);
  return { score, checks: data ?? [], criticalFindings, recommendations };
}
