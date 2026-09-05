/**
 * Every `onConflict` names a constraint that actually exists.
 *
 * This is a guard against a bug that cost real data. `conversion.ts` upserted
 * sis_enrollments with onConflict "student_id,school_year_id". Migration 229
 * dropped that constraint so a child could hold several programs in one year,
 * and replaced it with (student_id, school_year_id, program). Postgres answered
 * 42P10 — and because the call discarded its result, the student was created,
 * the conversion reported success, and the enrolment row was never written.
 *
 * A test that mocked Supabase would not have caught it: the mock would happily
 * accept any conflict target. What was wrong was the agreement between the code
 * and the schema, so that is what this checks.
 *
 * Reading source text is unusual for a unit test and deliberate here. The whole
 * failure was that nothing compared those two places.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file, not from process.cwd(). The test runner's working
// directory is not ours to assume, and a wrong root would make every assertion
// below either throw or pass vacuously.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SRC = join(REPO_ROOT, "src");
const MIGRATIONS = join(REPO_ROOT, "supabase", "migrations");

/**
 * Walk with dirents rather than statSync — one syscall per directory instead of
 * one per entry, and no second lookup that can fail on a path the listing was
 * happy to return. Unreadable directories are skipped rather than thrown,
 * because a permission quirk in one folder should not silence the whole guard.
 * The count assertion below is what stops that leniency becoming a blind spot.
 */
function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name) && entry.name !== "database.ts") {
      out.push(full);
    }
  }
  return out;
}

// Walked once. Three tests over a few thousand files is otherwise several
// seconds of pure I/O in a suite that already flakes when starved of CPU.
let sourceFiles: string[] | null = null;
function sources(): string[] {
  if (sourceFiles === null) sourceFiles = walk(SRC);
  return sourceFiles;
}

/** Every `onConflict: "a,b,c"` in the application source, with its file. */
let conflictTargets: { file: string; columns: string[] }[] | null = null;
function collectConflictTargets(): { file: string; columns: string[] }[] {
  if (conflictTargets !== null) return conflictTargets;
  const found: { file: string; columns: string[] }[] = [];
  for (const file of sources()) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(/onConflict:\s*"([^"]+)"/g)) {
      found.push({
        file: file.slice(SRC.length + 1).split("\\").join("/"),
        columns: m[1]!.split(",").map((c) => c.trim()).filter(Boolean),
      });
    }
  }
  conflictTargets = found;
  return found;
}

describe("upsert conflict targets", () => {
  it("can see the source tree it is supposed to be checking", () => {
    // If the root resolves wrong, every assertion below passes for the wrong
    // reason. Fail loudly and say where it looked.
    expect(sources().length, `no .ts files found under ${SRC}`).toBeGreaterThan(100);
  });

  it("finds the upserts, so a rename cannot make this test vacuously pass", () => {
    // An empty result set would make the assertion below trivially true. That
    // is how a guard rots into decoration.
    const targets = collectConflictTargets();
    expect(targets.length, "no onConflict: \"...\" found anywhere in src").toBeGreaterThan(0);
  });

  it("never targets (student_id, school_year_id) on sis_enrollments", () => {
    // The constraint migration 229 dropped. Naming it is always 42P10.
    const offenders = collectConflictTargets().filter((t) => {
      const set = new Set(t.columns);
      return set.size === 2 && set.has("student_id") && set.has("school_year_id");
    });

    expect(offenders.map((o) => `${o.file}: ${o.columns.join(",")}`)).toEqual([]);
  });

  it("still has the (student_id, school_year_id, program) constraint in the schema", () => {
    // If someone drops this one too, the conversion breaks again and the test
    // above keeps passing. Check the schema, not just the code.
    let files: string[];
    try {
      files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"));
    } catch {
      files = [];
    }
    expect(files.length, `no migrations found under ${MIGRATIONS}`).toBeGreaterThan(0);

    const sql = files.map((f) => readFileSync(join(MIGRATIONS, f), "utf8")).join("\n");
    expect(sql).toMatch(/sis_enrollments_student_year_program_unique/);
  });
});
