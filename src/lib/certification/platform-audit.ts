import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export type AuditCategory =
  | "critical" | "high" | "medium" | "low" | "technical_debt"
  | "performance" | "security" | "ui" | "accessibility";

export interface PlatformAuditFinding {
  findingKey: string;
  category: AuditCategory;
  domain: string;
  title: string;
  description: string;
  recommendation?: string;
  filePath?: string;
}

const STATIC_FINDINGS: PlatformAuditFinding[] = [
  { findingKey: "connector_oauth_v1_scope", category: "high", domain: "integrations", title: "OAuth sync scoped to v1.0 file import", description: "Live OAuth/API connector sync disabled; use CSV/QuickBooks file import. Sync jobs fail with explicit message.", recommendation: "Implement OAuth for QuickBooks, Google, Microsoft in v1.1 if required.", filePath: "src/lib/enterprise-data/sync-engine.ts" },
  { findingKey: "qbo_oauth_pending", category: "high", domain: "integrations", title: "QuickBooks OAuth pending", description: "File import supported; live QuickBooks Online OAuth sync not wired.", recommendation: "Use CSV import for v1.0 or complete OAuth in v1.1.", filePath: "src/lib/financial-intelligence/quickbooks-import.ts" },
  { findingKey: "rate_limit_partial", category: "high", domain: "security", title: "API rate limiting partial", description: "Rate limits enforced on scholarship API; other routes rely on permission guards only.", recommendation: "Extend rate limiting to public and high-volume API routes (Phase 2).", filePath: "src/lib/platform/api-rate-limit.ts" },
  { findingKey: "sms_not_configured", category: "medium", domain: "communications", title: "SMS delivery not configured", description: "Admissions SMS logged only; Twilio not wired for v1.0.", recommendation: "Integrate Twilio in v1.1 if SMS required.", filePath: "src/lib/admissions/communications/engine.ts" },
  { findingKey: "automation_stubs", category: "medium", domain: "technical_debt", title: "Automation action stubs fail explicitly", description: "9 platform automation stubs now return errors instead of silent success.", recommendation: "Implement handlers in v1.1.", filePath: "src/lib/platform/automation/action-registry.ts" },
  { findingKey: "demo_artifacts_placeholder", category: "medium", domain: "technical_debt", title: "Demo generator uses sample counts", description: "Demo provisioning creates org; relational seed counts computed at generation time.", recommendation: "Run demo generator before sales demos.", filePath: "src/lib/certification/demo-generator.ts" },
  { findingKey: "public_api_docs", category: "low", domain: "security", title: "Public API doc routes", description: "/api/*/docs endpoints expose metadata without auth — intentional for developer portal.", recommendation: "Acceptable for v1.0; restrict if sensitive metadata added.", filePath: "src/app/api/integrations/docs/route.ts" },
  { findingKey: "placeholder_nav_titles", category: "low", domain: "ui", title: "Navigation placeholder subtitles", description: "Some modules use placeholderTitle in navigation.ts for edge routes.", recommendation: "Polish during UX pass.", filePath: "src/lib/dashboard/navigation.ts" },
  { findingKey: "index_mission_control", category: "performance", domain: "performance", title: "Mission Control index added", description: "Partial index on unresolved mission control items for queue dashboard performance.", recommendation: "Apply migration 128.", filePath: "supabase/migrations/128_release_v1_launch_audit.sql" },
  { findingKey: "a11y_manual_required", category: "accessibility", domain: "accessibility", title: "Manual WCAG audit required", description: "Login form accessibility fixed; full-site axe/Lighthouse audit still required.", recommendation: "Run manual accessibility audit before launch sign-off.", filePath: "src/lib/certification/accessibility-engine.ts" },
  { findingKey: "cron_configured", category: "high", domain: "operations", title: "Queue cron configured", description: "vercel.json schedules process-queues every 6 hours with CRON_SECRET support.", recommendation: "Set CRON_SECRET in production environment.", filePath: "vercel.json" },
  { findingKey: "edp_import_commit_scope", category: "medium", domain: "data", title: "EDP import commit limited", description: "Only quickbooks and financial_transaction import types commit in v1.0.", recommendation: "Expand commit handlers in future releases.", filePath: "src/lib/enterprise-data/import-engine.ts" },
];

export async function runPlatformAudit(supabase: AuthClient, certRunId?: string): Promise<{
  findings: PlatformAuditFinding[];
  summary: Record<AuditCategory, number>;
}> {
  const findings = [...STATIC_FINDINGS];

  if (!process.env.SENDGRID_API_KEY && process.env.NODE_ENV === "production") {
    findings.push({
      findingKey: "sendgrid_missing_prod",
      category: "critical",
      domain: "communications",
      title: "SendGrid not configured in production",
      description: "SENDGRID_API_KEY is required for admissions email delivery in production.",
      recommendation: "Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in Vercel.",
    });
  }

  if (!process.env.VAULT_ENCRYPTION_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    findings.push({
      findingKey: "vault_key_missing",
      category: "critical",
      domain: "security",
      title: "Vault encryption key not configured",
      description: "VAULT_ENCRYPTION_KEY required for credential vault in production.",
      recommendation: "Set VAULT_ENCRYPTION_KEY in production environment.",
      filePath: "src/lib/integration-hub/vault-crypto.ts",
    });
  }

  const { count: completedRuns } = await supabase
    .from("cert_runs")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  if ((completedRuns ?? 0) === 0) {
    findings.push({
      findingKey: "no_cert_runs",
      category: "medium",
      domain: "certification",
      title: "No certification runs yet",
      description: "Run full certification before v1.0 launch sign-off.",
      recommendation: "Use Launch Readiness dashboard Run full certification button.",
    });
  }

  const { count: openCritical } = await supabase
    .from("platform_mission_control_items")
    .select("id", { count: "exact", head: true })
    .eq("is_resolved", false)
    .eq("severity", "critical");

  if ((openCritical ?? 0) > 0) {
    findings.push({
      findingKey: "open_critical_mc",
      category: "high",
      domain: "mission_control",
      title: `${openCritical} critical Mission Control alerts`,
      description: "Unresolved critical platform alerts require attention before launch.",
      recommendation: "Resolve in Mission Control before go-live.",
      filePath: "/dashboard/mission-control",
    });
  }

  const summary = findings.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] ?? 0) + 1;
    return acc;
  }, {} as Record<AuditCategory, number>);

  if (certRunId) {
    await supabase.from("cert_platform_audit_findings").delete().eq("audit_run_id", certRunId);
    for (const f of findings) {
      await supabase.from("cert_platform_audit_findings").insert({
        audit_run_id: certRunId,
        finding_key: f.findingKey,
        category: f.category,
        domain: f.domain,
        title: f.title,
        description: f.description,
        recommendation: f.recommendation ?? null,
        file_path: f.filePath ?? null,
      });
    }
  }

  return { findings, summary };
}

export async function getLatestAuditFindings(supabase: AuthClient, category?: AuditCategory) {
  let q = supabase
    .from("cert_platform_audit_findings")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  if (category) q = q.eq("category", category);
  const { data } = await q;
  return data ?? [];
}

export async function getAuditSummary(supabase: AuthClient) {
  const findings = await getLatestAuditFindings(supabase);
  return findings.reduce((acc, f) => {
    acc[f.category as AuditCategory] = (acc[f.category as AuditCategory] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
