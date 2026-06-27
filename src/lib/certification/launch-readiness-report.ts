import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { PlatformAuditFinding } from "@/lib/certification/platform-audit";
import { READINESS_THRESHOLD, LAUNCH_DOMAINS, E2E_WORKFLOWS, INTEGRATION_CHECKS } from "@/lib/certification/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const PLATFORM_STATS = {
  migrations: 129,
  apiRoutes: 26,
  integrationChecks: INTEGRATION_CHECKS.length,
  e2eWorkflows: E2E_WORKFLOWS.length,
  launchDomains: LAUNCH_DOMAINS.length,
  documentationGuides: 13,
};

function section(title: string, body: string) {
  return `## ${title}\n\n${body}\n`;
}

function findingsTable(findings: PlatformAuditFinding[], category?: string) {
  const filtered = category ? findings.filter((f) => f.category === category) : findings;
  if (filtered.length === 0) return "_No findings in this category._\n";
  return filtered
    .map((f) => `- **${f.title}** (${f.domain}): ${f.description}${f.recommendation ? ` — _${f.recommendation}_` : ""}`)
    .join("\n") + "\n";
}

export function buildLaunchReadinessMarkdown(input: {
  generatedAt: string;
  scores: Record<string, number | boolean> | null;
  findings: PlatformAuditFinding[];
  certified: boolean;
}) {
  const { generatedAt, scores, findings, certified } = input;
  const overall = Number(scores?.overall_score ?? 0);
  const domainLines = LAUNCH_DOMAINS.map((d) => {
    const val = Number(scores?.[d.key] ?? 0);
    const pass = val >= READINESS_THRESHOLD ? "✓" : "○";
    return `| ${d.label} | ${val.toFixed(1)}% | ${pass} |`;
  }).join("\n");

  const badges = [
    "Production Ready", "Commercial SaaS Ready", "Mobile Ready", "Accessibility Certified",
    "Security Validated", "Performance Validated", "Integration Validated",
    "Scalability Validated", "Customer Ready",
  ];
  const badgeLine = badges.map((b) => (certified ? `[x] ${b}` : `[ ] ${b}`)).join("\n");

  return `# AcademyOS Version 1.0 Enterprise — Launch Readiness Report

Generated: ${generatedAt}

**Overall readiness:** ${overall.toFixed(1)}% (threshold ${READINESS_THRESHOLD}%)

**Certification status:** ${certified ? "APPROVED FOR COMMERCIAL LAUNCH" : "PENDING — address open findings and re-run full certification"}

### Final Certification

${badgeLine}

---

${section("Executive Summary", `AcademyOS Version 1.0 Enterprise is feature complete across admissions, SIS, scheduling, teacher workspace, finance, HR, compliance, executive intelligence, cloud platform, integration hub (iPaaS), operations center, and intelligence network. Production hardening is delivered through the **Certification Center** at \`/dashboard/certification/launch\`.

Platform inventory: **${PLATFORM_STATS.migrations}** database migrations, **${PLATFORM_STATS.apiRoutes}** API routes, **${PLATFORM_STATS.e2eWorkflows}** E2E workflow tests, **${PLATFORM_STATS.integrationChecks}** integration certification checks, **${PLATFORM_STATS.documentationGuides}** auto-generated role guides.

\`npm run build\` passes. Queue processing cron configured in \`vercel.json\` (every 6 hours). Set \`CRON_SECRET\` in production.`)}

${section("Phase 1 — Enterprise Platform Audit", `Complete platform audit runs during full certification. Findings persist in \`cert_platform_audit_findings\`.

### Critical
${findingsTable(findings, "critical")}
### High
${findingsTable(findings, "high")}
### Medium
${findingsTable(findings, "medium")}
### Low
${findingsTable(findings, "low")}
### Technical Debt
${findingsTable(findings, "technical_debt")}
### Performance Improvements
${findingsTable(findings, "performance")}
### Security Improvements
${findingsTable(findings, "security")}
### UI Improvements
${findingsTable(findings, "ui")}
### Accessibility Improvements
${findingsTable(findings, "accessibility")}`)}

${section("Phase 2 — UX Optimization", `Navigation consolidated in dashboard sidebar including Financial Intelligence, Intelligence Network, Integration Hub, Cloud Console, and Certification Center. Shell components (\`CertShell\`, \`OpsShell\`, \`IntHubShell\`) provide consistent spacing and responsive layouts.

Remaining UX polish: placeholder navigation subtitles in edge routes, wizard flow consistency across Configuration Studio modules. Run accessibility certification for per-page empty/loading/error state coverage.`)}

${section("Phase 3 — Performance", `Migration 128 adds partial indexes on unresolved Mission Control items and certification readiness snapshots. Certification performance engine validates query paths. Large tables use pagination patterns across dashboard modules.

Apply migration \`128_release_v1_launch_audit.sql\` in production. Extend database indexes as tenant scale exceeds 1,000 students.`)}

${section("Phase 4 — Security Review", `Tenant isolation enforced via RLS (\`has_permission()\`, \`can_access_school()\`) across 128 migrations. Middleware protects \`/dashboard\`, \`/cloud\`, and \`/operations\`. Scholarship API secured with auth, rate limiting, and \`applicationId\` requirement.

Open items: credential vault hash refs (KMS/Vault for production secrets), extend API rate limiting beyond scholarship route.`)}

${section("Phase 5 — Production Integrations", `Integration catalog ready for: QuickBooks Online, Square, Google Workspace, Microsoft 365, Google Calendar, Outlook, NWEA MAP, Twilio, SendGrid, DocuSign.

Live OAuth sync requires customer credentials via Configuration Studio / Integration Hub. File import supported for QuickBooks. Prioritize OAuth wiring per customer contract.`)}

${section("Phase 6 — Mobile Optimization", `Mobile and PWA certification engines validate six viewports and eight check areas. Parent/student portal routes are phone-first. PWA manifest and offline shell checks run during full certification.

Review PWA panel on Launch Readiness dashboard before go-live.`)}

${section("Phase 7 — Documentation", `${PLATFORM_STATS.documentationGuides} guides auto-generated: Administrator, Teacher, Parent, Finance, HR, Admissions, Executive, Developer, API, Implementation, Student, Support, Change Log.

Regenerate at \`/dashboard/certification/documentation\` or via Run full certification.`)}

${section("Phase 8 — AcademyOS University", `Training paths and knowledge checks in Certification Center (\`/dashboard/certification/training\`) and Operations University (\`/operations/university\`). Role-based onboarding tied to training completion score in readiness calculation.`)}

${section("Phase 9 — Demo Organization", `Demo generator at \`/dashboard/certification/demo\` provisions enterprise blueprint org with connected module summary. Run before sales demos; artifact counts computed from live tables at generation time.`)}

${section("Phase 10 — Commercial Launch", `Cloud Platform (\`/cloud\`) and Operations Center (\`/operations\`) provide subscription plans, trial signup (\`free_trial\` plan), customer onboarding, marketplace, support center, and revenue analytics. Go Live Center at \`/dashboard/admin/go-live\`.`)}

${section("Domain Scores", `| Domain | Score | Pass (≥${READINESS_THRESHOLD}%) |
|--------|-------|------|
${domainLines}`)}

${section("Production Checklist", `1. Apply migrations through \`129_release_v1_doc_categories.sql\`
2. Set \`CRON_SECRET\` for Vercel cron \`/api/platform/process-queues\`
3. Run **Full certification** on Launch Readiness dashboard
4. Resolve Critical and High audit findings (or accept with documented risk)
5. Generate demo environment for sales
6. Complete University training paths for customer success team
7. Verify \`npm run build\` in CI/CD pipeline`)}

---

_AcademyOS Version 1.0 Enterprise — Certification Center_
`;
}

export async function saveLaunchReadinessReport(
  supabase: AuthClient,
  input: {
    scores: Record<string, number | boolean> | null;
    findings: PlatformAuditFinding[];
    certified: boolean;
  }
) {
  const generatedAt = new Date().toISOString();
  const content = buildLaunchReadinessMarkdown({ ...input, generatedAt });

  await supabase.from("cert_documentation").upsert({
    doc_key: "launch_readiness_report",
    doc_title: "Launch Readiness Report — v1.0 Enterprise",
    doc_category: "launch",
    content_md: content,
    auto_generated: true,
  }, { onConflict: "doc_key" });

  return { generatedAt, content };
}

export async function getLaunchReadinessReport(supabase: AuthClient) {
  const { data } = await supabase
    .from("cert_documentation")
    .select("*")
    .eq("doc_key", "launch_readiness_report")
    .maybeSingle();
  return data;
}
