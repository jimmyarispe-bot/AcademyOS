/** RC-11 — Production readiness unit tests. */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ensureProductionIntegrationsRegistered,
  listPriorityIntegrationHealth,
  listRealtimeTopics,
  subscribeProductionTopic,
  invokePriorityIntegration,
} from "@/lib/production";
import {
  MODULE_RELEASE_REGISTRY,
  evaluateAccessibilityGate,
  evaluateMobileGate,
  evaluatePerformanceGate,
  buildReleaseDashboardRows,
  buildReleaseReport,
} from "@/lib/platform/release";

const ROOT = process.cwd();

describe("RC-11 — Production Readiness", () => {
  it("registers priority integrations via extension architecture", () => {
    ensureProductionIntegrationsRegistered();
    const health = listPriorityIntegrationHealth();
    expect(health.length).toBeGreaterThanOrEqual(8);
    for (const row of health) {
      expect(row.registered, row.id).toBe(true);
    }
    const ids = new Set(health.map((h) => h.id));
    for (const id of [
      "google_workspace",
      "supabase_storage",
      "square",
      "stripe",
      "quickbooks_online",
      "twilio",
      "docusign",
      "google_calendar",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("invokes deferred integrations without throwing", async () => {
    const result = await invokePriorityIntegration(
      "docusign",
      "send_envelope",
      "custom",
      { documentId: "test" }
    );
    expect(result.ok).toBe(true);
    expect(result.deferred).toBe(true);
  });

  it("exposes realtime topics with poll fallback", () => {
    const topics = listRealtimeTopics();
    expect(topics).toEqual(
      expect.arrayContaining([
        "founder_dashboard",
        "executive_dashboard",
        "notifications",
        "workflow_status",
        "insight_updates",
      ])
    );
    const sub = subscribeProductionTopic(null, "notifications", () => undefined);
    expect(sub.mode).toBe("poll");
    sub.unsubscribe();
  });

  it("a11y / mobile / performance gates can pass with RC11 evidence", () => {
    const mod = MODULE_RELEASE_REGISTRY[0];
    expect(evaluateAccessibilityGate(mod).verdict).not.toBe("fail");
    expect(evaluateMobileGate(mod).verdict).not.toBe("fail");
    expect(evaluatePerformanceGate(mod).verdict).not.toBe("fail");
  });

  // 20s, not the 5s default. This test walks the repository -- every gate for
  // every module -- and on a loaded Windows box inside the full 2555-test run
  // that intermittently crossed 5s and failed as if the code were broken. The
  // readers are memoised now, which took a repeat call from ~430ms to ~10ms,
  // but a COLD first call still does real disk work and its duration is a
  // property of the machine, not of the code under test.
  it("release dashboard includes RC11 readiness columns", () => {
    const rows = buildReleaseDashboardRows();
    expect(rows.length).toBeGreaterThan(0);
    const sample = rows[0];
    expect(sample.cells.accessibility).toBeDefined();
    expect(sample.cells.mobile).toBeDefined();
    expect(sample.cells.performance).toBeDefined();
    expect(sample.cells.extension).toBeDefined();
    expect(sample.cells.security).toBeDefined();
  }, 20_000);

  it("ops runbooks exist for deploy / rollback / DR", () => {
    for (const rel of [
      "docs/operations/rc11/07_DEPLOYMENT_RUNBOOK.md",
      "docs/operations/rc11/08_ROLLBACK.md",
      "docs/operations/rc11/09_MONITORING_PLAYBOOK.md",
      "docs/operations/rc11/10_INCIDENT_RESPONSE.md",
      "docs/operations/rc11/11_PRODUCTION_CHECKLIST.md",
      "docs/operations/rc11/12_DISASTER_RECOVERY.md",
      "scripts/validate-a11y.mts",
      "scripts/validate-mobile.mts",
      "scripts/validate-performance.mts",
    ]) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true);
    }
  });

  it("release report builds without throwing", () => {
    const report = buildReleaseReport();
    expect(report.generatedAt).toBeTruthy();
    expect(Array.isArray(report.modules)).toBe(true);
  });
});
