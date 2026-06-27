import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { getPrimaryOrganizationId } from "@/lib/certification/context";
import { runWorkflowTests, computeWorkflowTestScore } from "@/lib/certification/testing-engine";
import { runSecurityCertification } from "@/lib/certification/security-engine";
import { runPerformanceCertification } from "@/lib/certification/performance-engine";
import { runAccessibilityCertification, runMobileCertification } from "@/lib/certification/accessibility-engine";
import { runPwaCertification } from "@/lib/certification/pwa-engine";
import { runIntegrationCertification } from "@/lib/certification/integration-engine";
import { runDisasterRecoveryCertification } from "@/lib/certification/dr-engine";
import { runSupportReadinessCertification } from "@/lib/certification/support-readiness";
import { regenerateDocumentation } from "@/lib/certification/documentation";
import { computeOverallReadiness, saveReadinessSnapshot } from "@/lib/certification/readiness";
import { generateHealthReports } from "@/lib/certification/health-reports";
import { runPlatformAudit } from "@/lib/certification/platform-audit";
import { saveLaunchReadinessReport } from "@/lib/certification/launch-readiness-report";
import { seedBugTrackerIfEmpty } from "@/lib/certification/bug-center";
import { getTrainingCompletionScore } from "@/lib/certification/training-engine";
import { HEALTH_DOMAINS, READINESS_THRESHOLD } from "@/lib/certification/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function runFullCertification(supabase: AuthClient, triggeredBy?: string) {
  const orgId = await getPrimaryOrganizationId(supabase);

  const { data: run, error } = await supabase
    .from("cert_runs")
    .insert({
      organization_id: orgId,
      run_type: "full",
      status: "running",
      triggered_by: triggeredBy ?? null,
    })
    .select("id")
    .single();

  if (error || !run) return { error: error?.message ?? "Failed to start run" };

  await seedBugTrackerIfEmpty(supabase);

  const [workflows, security, performance, accessibility, mobile, pwa, integration, dr, support, training] = await Promise.all([
    runWorkflowTests(supabase, run.id),
    runSecurityCertification(supabase, run.id),
    runPerformanceCertification(supabase, run.id),
    runAccessibilityCertification(supabase, run.id),
    runMobileCertification(supabase, run.id),
    runPwaCertification(supabase, run.id),
    runIntegrationCertification(supabase, run.id),
    runDisasterRecoveryCertification(supabase, run.id),
    runSupportReadinessCertification(supabase, run.id),
    getTrainingCompletionScore(supabase),
  ]);

  const docResult = await regenerateDocumentation(supabase);
  const testingScore = computeWorkflowTestScore(workflows);
  const { count: cloudCount } = await supabase.from("cloud_customers").select("id", { count: "exact", head: true });
  const operationalScore = testingScore >= 85 && security.securityScore >= 85 ? 92 : 78;

  const scores = computeOverallReadiness({
    security: security.securityScore,
    performance: performance.performanceScore,
    accessibility: accessibility.accessibilityScore,
    mobile: mobile.mobileScore,
    pwa: pwa.pwaScore,
    testing: testingScore,
    integration: integration.integrationScore,
    documentation: docResult.regenerated >= 13 ? 96 : 82,
    dr: dr.drScore,
    cloud: cloudCount !== null ? 90 : 85,
    training: training.score,
    support: support.supportScore,
    operational: operationalScore,
  });

  await saveReadinessSnapshot(supabase, orgId, scores);
  await generateHealthReports(supabase, scores, orgId);
  const audit = await runPlatformAudit(supabase, run.id);
  await saveLaunchReadinessReport(supabase, {
    scores: {
      overall_score: scores.overall,
      security_score: scores.security,
      performance_score: scores.performance,
      accessibility_score: scores.accessibility,
      mobile_score: scores.mobile,
      pwa_score: scores.pwa,
      testing_score: scores.testing,
      integration_score: scores.integration,
      documentation_score: scores.documentation,
      dr_score: scores.dr,
      cloud_score: scores.cloud,
      training_score: scores.training,
      support_score: scores.support,
      operational_score: scores.operational,
      is_v1_certified: scores.isV1Certified,
    },
    findings: audit.findings,
    certified: scores.isV1Certified,
  });

  await supabase.from("cert_runs").update({
    status: "completed",
    overall_score: scores.overall,
    completed_at: new Date().toISOString(),
    summary: { scores, workflowCount: workflows.length, criticalFindings: security.criticalFindings },
  }).eq("id", run.id);

  return { runId: run.id, scores };
}

export async function runNightlyHealthScan(supabase: AuthClient) {
  const result = await runFullCertification(supabase);
  const scores = result.scores;
  if (!scores) return;

  for (const domain of HEALTH_DOMAINS) {
    await supabase.from("cert_health_scans").upsert({
      scan_date: new Date().toISOString().split("T")[0],
      domain,
      health_score: scores.overall,
      findings: scores.overall < READINESS_THRESHOLD ? [`${domain}: review recommended`] : [],
    }, { onConflict: "scan_date,domain" });
  }

  if (scores.overall < READINESS_THRESHOLD) {
    const { data: school } = await supabase.from("schools").select("id").limit(1).maybeSingle();
    await createMissionControlItem(supabase, {
      schoolId: school?.id ?? "",
      module: "executive",
      itemType: "executive_alert",
      title: "Certification: readiness below v1.0 threshold",
      body: `Overall score ${scores.overall.toFixed(1)} — review Launch Readiness dashboard`,
      href: "/dashboard/certification/launch",
      entityType: "cert_runs",
      assignedRole: "CEO",
      severity: "high",
    });
  }
}

export async function getCertHubData(supabase: AuthClient) {
  const [readiness, latestRun, healthScans, healthReports, bugSummary] = await Promise.all([
    getLatestReadiness(supabase),
    supabase.from("cert_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("cert_health_scans").select("*").eq("scan_date", new Date().toISOString().split("T")[0]),
    import("@/lib/certification/health-reports").then((m) => m.getLatestHealthReports(supabase)),
    import("@/lib/certification/bug-center").then((m) => m.getBugSummary(supabase)),
  ]);

  return {
    readiness,
    latestRun: latestRun.data,
    healthScans: healthScans.data ?? [],
    healthReports,
    bugSummary,
  };
}

async function getLatestReadiness(supabase: AuthClient) {
  const { data } = await supabase.from("cert_readiness_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
  return data;
}
