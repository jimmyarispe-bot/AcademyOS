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
  { findingKey: "connector_oauth_stub", category: "critical", domain: "integrations", title: "Live OAuth connectors not implemented", description: "40+ connector catalog entries; sync completes with 0 records until credentials configured.", recommendation: "Enable integrations via Configuration Studio; prioritize QuickBooks, Google, Microsoft for Phase 5.", filePath: "src/lib/enterprise-data/sync-engine.ts" },
  { findingKey: "credential_vault_hash", category: "critical", domain: "security", title: "Credential vault uses hash refs", description: "Secrets stored as SHA-256 refs — production requires KMS or Supabase Vault encryption.", recommendation: "Integrate Supabase Vault or external KMS before enterprise launch.", filePath: "src/lib/integration-hub/credential-vault.ts" },
  { findingKey: "rate_limit_partial", category: "high", domain: "security", title: "API rate limiting partial", description: "Rate limits enforced on scholarship API; other routes rely on permission guards only.", recommendation: "Extend rate limiting to public and high-volume API routes.", filePath: "src/lib/platform/api-rate-limit.ts" },
  { findingKey: "qbo_oauth_pending", category: "high", domain: "integrations", title: "QuickBooks OAuth pending", description: "File import supported; live QuickBooks Online OAuth sync architecture documented but not wired.", recommendation: "Complete Phase 5 QuickBooks OAuth or document file-import-only for v1.0.", filePath: "src/lib/financial-intelligence/quickbooks-import.ts" },
  { findingKey: "automation_stubs", category: "medium", domain: "technical_debt", title: "9 automation action stubs", description: "Platform automation registry contains placeholder actions.", recommendation: "Replace stubs or mark as future in admin UI.", filePath: "src/lib/platform/automation/action-registry.ts" },
  { findingKey: "scholarship_api_secured", category: "low", domain: "security", title: "Scholarship API hardened", description: "POST /api/scholarship requires auth (scholarships.view), rate limiting, and applicationId.", recommendation: "Monitor usage; extend rate limits to other public routes.", filePath: "src/app/api/scholarship/route.ts" },
  { findingKey: "demo_artifacts_placeholder", category: "medium", domain: "technical_debt", title: "Demo generator uses sample counts", description: "Demo provisioning creates org; relational seed counts now computed at generation time.", recommendation: "Run demo generator before sales demos.", filePath: "src/lib/certification/demo-generator.ts" },
  { findingKey: "public_api_docs", category: "low", domain: "security", title: "Public API doc routes", description: "/api/*/docs endpoints expose metadata without auth — intentional for developer portal.", recommendation: "Acceptable for v1.0; restrict if sensitive metadata added.", filePath: "src/app/api/integrations/docs/route.ts" },
  { findingKey: "placeholder_nav_titles", category: "low", domain: "ui", title: "Navigation placeholder subtitles", description: "Some modules use placeholderTitle in navigation.ts for edge routes.", recommendation: "Polish during UX pass.", filePath: "src/lib/dashboard/navigation.ts" },
  { findingKey: "index_mission_control", category: "performance", domain: "performance", title: "Mission Control index added", description: "Partial index on unresolved mission control items for queue dashboard performance.", recommendation: "Apply migration 128.", filePath: "supabase/migrations/128_release_v1_launch_audit.sql" },
  { findingKey: "a11y_cert_pass", category: "accessibility", domain: "accessibility", title: "Accessibility certification engine active", description: "Automated a11y checks run during full certification.", recommendation: "Maintain ≥85% score on launch dashboard.", filePath: "src/lib/certification/accessibility-engine.ts" },
  { findingKey: "cron_configured", category: "high", domain: "operations", title: "Queue cron configured", description: "vercel.json schedules process-queues every 6 hours with CRON_SECRET support.", recommendation: "Set CRON_SECRET in production environment.", filePath: "vercel.json" },
];

export async function runPlatformAudit(supabase: AuthClient, certRunId?: string): Promise<{
  findings: PlatformAuditFinding[];
  summary: Record<AuditCategory, number>;
}> {
  const findings = [...STATIC_FINDINGS];

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
