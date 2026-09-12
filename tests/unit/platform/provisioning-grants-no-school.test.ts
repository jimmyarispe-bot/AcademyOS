import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No migration may name a campus by uuid inside the auth provisioning function.
 *
 * THE BUG THIS GUARDS. `provision_auth_user` runs from the on_auth_user_created
 * trigger, in the same transaction that creates a person's users row. It
 * contained this:
 *
 *     -- Prefer Academy FL as primary school when present
 *     select s.id into v_primary_school_id
 *     from public.schools s
 *     where s.organization_id = v_org_id
 *       and s.id = 'a1000000-0000-4000-8000-000000000001'
 *
 * Every non-founder account ever created was attached to The Academy FL, marked
 * primary, before any administrator chose anything. Somebody assigned to
 * Georgia held Georgia and Florida, and their workspace header read Florida.
 * Nobody saw it, because nothing in the product shows you what a trigger did on
 * your behalf.
 *
 * WHY THIS TEST IS SHAPED LIKE THIS. A test that checked Nina's rows would pass
 * the moment her rows were fixed and tell us nothing about the next account. The
 * defect is not in anybody's data — it is a hard-coded campus in provisioning
 * code, and the only durable guard is that no such constant may appear there
 * again. The rule is: provisioning gives you a role; a human gives you a campus.
 *
 * It reads the migration files rather than the database, because a migration is
 * where a constant like that gets reintroduced, and it fails at the point the
 * file is written rather than after it has run in production.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** The seeded campuses. Any of these appearing in provisioning is the bug. */
const CAMPUS_UUID = /a1000000-0000-4000-8000-0000000000\d\d/gi;

function provisioningFunctionBodies(sql: string): string[] {
  // Each `create or replace function public.provision_auth_user ... $$;` body.
  const bodies: string[] = [];
  const re = /create\s+or\s+replace\s+function\s+public\.provision_auth_user[\s\S]*?\$\$;/gi;
  for (const match of sql.matchAll(re)) bodies.push(match[0]);
  return bodies;
}

/** Comments explain the bug; they are not the bug. Strip them before checking. */
function withoutComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("auth provisioning", () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

  it("has migrations to read", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("never hard-codes a campus in provision_auth_user", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      for (const body of provisioningFunctionBodies(sql)) {
        if (CAMPUS_UUID.test(withoutComments(body))) {
          offenders.push(file);
        }
        CAMPUS_UUID.lastIndex = 0;
      }
    }

    // 175 is the original offender and stays on disk as history; 348 replaces
    // the function without a campus in it. Anything else added to this list
    // means somebody put a campus back into provisioning.
    expect(offenders).toEqual(["175_complete_auth_user_provisioning.sql"]);
  });

  /**
   * The last definition wins at runtime, so whatever the highest-numbered
   * migration says is what the database does. That one must be clean.
   */
  it("leaves the live definition free of any campus", () => {
    const defining = files.filter(
      (f) => provisioningFunctionBodies(readFileSync(join(MIGRATIONS_DIR, f), "utf8")).length > 0
    );

    expect(defining.length).toBeGreaterThan(0);

    const latest = defining[defining.length - 1]!;
    const bodies = provisioningFunctionBodies(readFileSync(join(MIGRATIONS_DIR, latest), "utf8"));
    const live = withoutComments(bodies[bodies.length - 1]!);

    expect(CAMPUS_UUID.test(live)).toBe(false);
    CAMPUS_UUID.lastIndex = 0;
  });

  /**
   * Founders are the one case where "all of them" is the right answer, and it
   * comes from a configured bootstrap list rather than a guess. Losing that
   * branch would lock the first administrator out of their own schools.
   */
  it("still gives founders every school in their organisation", () => {
    const sql = readFileSync(
      join(MIGRATIONS_DIR, "348_provisioning_stops_assigning_florida_2026_09_12.sql"),
      "utf8"
    );
    const body = provisioningFunctionBodies(sql).at(-1)!;

    expect(body).toContain("if v_is_founder then");
    expect(body).toContain("insert into public.user_schools");
    expect(body).toContain("where s.organization_id = v_org_id");
  });

  /**
   * And the point of the whole exercise: there is no school insert outside the
   * founder branch. If one appears, somebody has restored a default.
   */
  it("grants no school to anybody who is not a founder", () => {
    const sql = readFileSync(
      join(MIGRATIONS_DIR, "348_provisioning_stops_assigning_florida_2026_09_12.sql"),
      "utf8"
    );
    const body = withoutComments(provisioningFunctionBodies(sql).at(-1)!);

    const founderBranch = body.indexOf("if v_is_founder then");
    expect(founderBranch).toBeGreaterThan(-1);

    const beforeFounderBranch = body.slice(0, founderBranch);
    expect(beforeFounderBranch).not.toContain("insert into public.user_schools");
    expect(beforeFounderBranch).not.toContain("insert into public.user_org_assignments");
  });
});
