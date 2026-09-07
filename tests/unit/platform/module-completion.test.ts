import { describe, expect, it } from "vitest";
import {
  MODULE_COMPLETION_RULE_V2,
  READINESS_ORDER,
  buildReleaseReport,
  evaluateCrudGate,
  evaluateEiGate,
  evaluateWorkflowGate,
  getModuleDefinition,
  listModuleDefinitions,
} from "@/lib/platform/release";

describe("Module Completion Standard v2", () => {
  it("states the completion rule", () => {
    expect(MODULE_COMPLETION_RULE_V2).toMatch(/cannot be marked complete/i);
  });

  it("uses progressive readiness statuses", () => {
    expect(READINESS_ORDER).toContain("planned");
    expect(READINESS_ORDER).toContain("crud-complete");
    expect(READINESS_ORDER).toContain("production-ready");
    expect(READINESS_ORDER).toContain("released");
  });

  it("registers core modules", () => {
    const ids = listModuleDefinitions().map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "students",
        "families",
        "communications",
        "workflows",
        "calendar",
      ])
    );
  });

  it("students module passes CRUD / workflow / EI gates", () => {
    const students = getModuleDefinition("students")!;
    expect(evaluateCrudGate(students).verdict).not.toBe("fail");
    expect(evaluateWorkflowGate(students).verdict).toBe("pass");
    expect(evaluateEiGate(students).verdict).toBe("pass");
  });

  // 20s, not the 5s default. This test walks the repository -- every gate for
  // every module -- and on a loaded Windows box inside the full 2555-test run
  // that intermittently crossed 5s and failed as if the code were broken. The
  // readers are memoised now, which took a repeat call from ~430ms to ~10ms,
  // but a COLD first call still does real disk work and its duration is a
  // property of the machine, not of the code under test.
  it("buildReleaseReport returns module snapshots", () => {
    const report = buildReleaseReport();
    expect(report.modules.length).toBeGreaterThanOrEqual(5);
    expect(report.generatedAt).toBeTruthy();
    expect(typeof report.ok).toBe("boolean");
  }, 20_000);
});
