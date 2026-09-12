import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DASHBOARD_MODULES } from "@/lib/dashboard/navigation";
import { MODULE_REQUIRED_PERMISSIONS, visibleModules } from "@/lib/dashboard/module-visibility";
import { visibleSubNav } from "@/app/dashboard/admissions/AdmissionsPageContent";

/**
 * A School Leader sees admissions and students. She does not see money.
 *
 * The requirement, verbatim: "both heather and nina should never see anything
 * about money, scholarships, funds, funding, taxes. only admissions related for
 * these 2 users."
 *
 * "Never see" is the demanding word. A permission check that fires when you open
 * a page is not enough — the Scholarships and Finance entries still sat in the
 * sidebar, and "State Funding" still sat in the admissions sub-navigation. She
 * could not read the numbers, but she could read that there are numbers, which
 * campus they belong to, and that she is being kept out. These tests are about
 * what renders, not about what a guard refuses.
 */

/** What a School Leader holds once migration 349's deny rows are applied. */
const SCHOOL_LEADER_PERMISSIONS = [
  "ACADEMYOS_ACCESS",
  "ADMISSIONS_ACCESS",
  "SIS_ACCESS",
  "REPORTING_ACCESS",
  "org.view",
  "users.view",
  "directory.view",
  "students.view",
  "students.edit",
  "students.attendance",
  "students.behavior",
  "students.services",
  "families.manage",
  "admissions.view",
  "admissions.accept",
  "admissions.manage",
  "workflows.view",
  "templates.manage",
  "school.configure",
];

/** Somebody who is meant to see money, as the control. */
const FINANCE_PERMISSIONS = [
  ...SCHOOL_LEADER_PERMISSIONS,
  "FINANCE_ACCESS",
  "finance.view",
  "funding.view",
  "scholarships.view",
];

const MONEY_WORDS = /money|scholarship|funding|finance|financial|tuition|billing|payroll|tax|invoice|revenue/i;

describe("what a School Leader is shown", () => {
  it("has no money module in the sidebar", () => {
    const shown = visibleModules(DASHBOARD_MODULES, SCHOOL_LEADER_PERMISSIONS);
    const ids = shown.map((m) => m.id);

    expect(ids).not.toContain("scholarships");
    expect(ids).not.toContain("finance");
  });

  it("still has the modules she works in", () => {
    const ids = visibleModules(DASHBOARD_MODULES, SCHOOL_LEADER_PERMISSIONS).map((m) => m.id);

    expect(ids).toContain("admissions");
    expect(ids).toContain("students");
  });

  /**
   * Not only the module id — the words. A module whose label or subtitle says
   * "scholarships" is money on her screen whatever it is called internally.
   */
  it("shows her no sidebar label that mentions money", () => {
    const shown = visibleModules(DASHBOARD_MODULES, SCHOOL_LEADER_PERMISSIONS);
    const offenders = shown.filter((m) => MONEY_WORDS.test(m.sidebarLabel));

    expect(offenders.map((m) => m.sidebarLabel)).toEqual([]);
  });

  it("does not list the funding destinations in admissions sub-navigation", () => {
    const labels = visibleSubNav(SCHOOL_LEADER_PERMISSIONS).map((i) => i.label);

    expect(labels).not.toContain("State Funding");
    expect(labels).not.toContain("Funding Programs");
    expect(labels).not.toContain("Reconciliation");
    // The admissions work is untouched.
    expect(labels).toContain("Waiting on us");
    expect(labels).toContain("Add Lead");
  });

  /** The control. Take away the denial and the money comes back. */
  it("shows all of it to somebody who does hold finance permissions", () => {
    const ids = visibleModules(DASHBOARD_MODULES, FINANCE_PERMISSIONS).map((m) => m.id);
    expect(ids).toContain("scholarships");
    expect(ids).toContain("finance");

    const labels = visibleSubNav(FINANCE_PERMISSIONS).map((i) => i.label);
    expect(labels).toContain("State Funding");
    expect(labels).toContain("Reconciliation");
  });

  /**
   * An empty permission list means the page could not work out who is reading.
   * That must hide the money, not reveal it.
   */
  it("hides money when the permission list is empty", () => {
    const ids = visibleModules(DASHBOARD_MODULES, []).map((m) => m.id);
    expect(ids).not.toContain("finance");
    expect(ids).not.toContain("scholarships");
  });

  /**
   * The durable rule. A module added later whose name is about money must come
   * with a permission gate, or it renders to everybody the way Finance did.
   */
  it("gates every money-shaped module that exists", () => {
    const ungated = DASHBOARD_MODULES.filter(
      (m) =>
        (MONEY_WORDS.test(m.sidebarLabel) || MONEY_WORDS.test(m.pageSubtitle)) &&
        !MODULE_REQUIRED_PERMISSIONS[m.id]
    );

    expect(ungated.map((m) => m.id)).toEqual([]);
  });
});

describe("the funding pages filed under admissions", () => {
  const PAGES = [
    "src/app/dashboard/admissions/state-funding/page.tsx",
    "src/app/dashboard/admissions/funding-programs/page.tsx",
    "src/app/dashboard/admissions/reconciliation/page.tsx",
  ];

  /**
   * These live under /dashboard/admissions, so the admissions layout's
   * `admissions.view` was the only thing in front of them. Sitting in that
   * folder is a routing decision, not a statement about who may read it.
   */
  it.each(PAGES)("%s asks for a funding permission of its own", (page) => {
    const src = readFileSync(join(process.cwd(), page), "utf8");

    expect(src).toContain("requirePagePermission");
    expect(src).toMatch(/funding\.view|finance\.state_funding/);
  });
});

describe("migration 349", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase",
      "migrations",
      "349_school_leader_no_money_2026_09_12.sql"
    ),
    "utf8"
  );

  /**
   * `deny`, not delete. Two places grant these — migration 074 in the database
   * and the ADMISSIONS_ACCESS group in TypeScript, which expands to include
   * scholarships.view and does not read this table. Deleting the row leaves the
   * code map intact and the permission still granted. A deny row is subtracted
   * by both.
   */
  it("denies rather than deletes", () => {
    expect(sql).toContain("'deny'");
    expect(sql).not.toMatch(/delete\s+from\s+public\.platform_role_permissions/i);
  });

  it("leaves admissions alone", () => {
    expect(sql).toContain("not like 'admissions.%'");
  });

  it("is re-runnable", () => {
    expect(sql).toContain("on conflict (role_id, permission_key) do update");
  });
});

describe("the migration directory", () => {
  it("has no duplicate 349", () => {
    const files = readdirSync(join(process.cwd(), "supabase", "migrations"));
    const three49 = files.filter((f) => f.startsWith("349_"));
    expect(three49).toHaveLength(1);
  });
});
