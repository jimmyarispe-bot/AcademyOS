/**
 * Next.js file-tracing safe filesystem readers for the release gates.
 *
 * NFT/Turbopack rejects `existsSync/readFileSync(join(ROOT, dynamic))` when the
 * dynamic segment can expand across the tree. Every FS call below uses a
 * string-literal path (or an allowlisted key mapped to a literal reader).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/**
 * MEMOISED, because these readers are neither cheap nor changing.
 *
 * buildReleaseReport() evaluates 14 gates across 14 modules, and the gates ask
 * this module hundreds of questions -- existsSync per probe, a RECURSIVE
 * directory walk per testPath, and a read of every migration SQL file. On a
 * warm Linux checkout that is ~400ms. Inside a 2555-test run on Windows, with
 * several vitest workers competing for the disk and a virus scanner opening
 * every file, it intermittently crossed the 5s test timeout -- which surfaced
 * as `release dashboard includes RC11 readiness columns` and `buildReleaseReport
 * returns module snapshots` failing together, at random, on changes that had
 * nothing to do with either. Two runs of identical code gave 1 failure, then 0,
 * then 2.
 *
 * The repository does not change while a process runs -- not during a test run,
 * and not in a deployed build where the tree is fixed at deploy time. So each
 * distinct question is answered from disk once.
 *
 * Cached by an explicit key rather than by arguments: several of these take a
 * moduleId plus a probe name, and a key built at the call site keeps the cache
 * honest about what it is keyed on.
 */
const fsCache = new Map<string, unknown>();

function memo<T>(key: string, compute: () => T): T {
  if (fsCache.has(key)) return fsCache.get(key) as T;
  const value = compute();
  fsCache.set(key, value);
  return value;
}

/** Tests that create or remove files mid-run must clear this. */
export function resetReleaseFsCache(): void {
  fsCache.clear();
}

function dirHasSourceFiles(abs: string): boolean {
  if (!existsSync(abs)) return false;
  try {
    const walk = (dir: string): boolean => {
      for (const name of readdirSync(dir)) {
        if (name.includes("..")) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (walk(p)) return true;
        } else if (/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(name) || name.endsWith(".ts")) {
          return true;
        }
      }
      return false;
    };
    const st = statSync(abs);
    if (st.isFile()) return true;
    return walk(abs);
  } catch {
    return false;
  }
}

const FEATURE_DOC_READERS: Record<string, () => string> = {
  "docs/features/student-management.md": () =>
    readFileSync(join(ROOT, "docs/features/student-management.md"), "utf8"),
  "docs/features/family-management.md": () =>
    readFileSync(join(ROOT, "docs/features/family-management.md"), "utf8"),
  "docs/features/communications.md": () =>
    readFileSync(join(ROOT, "docs/features/communications.md"), "utf8"),
  "docs/features/workflow-engine.md": () =>
    readFileSync(join(ROOT, "docs/features/workflow-engine.md"), "utf8"),
  "docs/features/calendar-platform.md": () =>
    readFileSync(join(ROOT, "docs/features/calendar-platform.md"), "utf8"),
  "docs/features/admissions.md": () =>
    readFileSync(join(ROOT, "docs/features/admissions.md"), "utf8"),
  "docs/features/human-capital-platform.md": () =>
    readFileSync(join(ROOT, "docs/features/human-capital-platform.md"), "utf8"),
  "docs/features/finance-platform.md": () =>
    readFileSync(join(ROOT, "docs/features/finance-platform.md"), "utf8"),
  "docs/features/scholarships.md": () =>
    readFileSync(join(ROOT, "docs/features/scholarships.md"), "utf8"),
  "docs/features/scheduling.md": () =>
    readFileSync(join(ROOT, "docs/features/scheduling.md"), "utf8"),
  "docs/features/document-management.md": () =>
    readFileSync(join(ROOT, "docs/features/document-management.md"), "utf8"),
  "docs/features/founder-intelligence.md": () =>
    readFileSync(join(ROOT, "docs/features/founder-intelligence.md"), "utf8"),
  "docs/features/settings.md": () =>
    readFileSync(join(ROOT, "docs/features/settings.md"), "utf8"),
  "docs/platform/jag-intelligence-engine.md": () =>
    readFileSync(join(ROOT, "docs/platform/jag-intelligence-engine.md"), "utf8"),
};

function uncached_moduleDocsExist(docsPath: string): boolean {
  const reader = FEATURE_DOC_READERS[docsPath];
  if (!reader) return false;
  try {
    reader();
    return true;
  } catch {
    return false;
  }
}

function uncached_readModuleDocs(docsPath: string): string | null {
  const reader = FEATURE_DOC_READERS[docsPath];
  if (!reader) return null;
  try {
    return reader();
  } catch {
    return null;
  }
}

function uncached_repoFileExists(relPath: string): boolean {
  switch (relPath) {
    case "src/lib/communications":
      return existsSync(join(ROOT, "src/lib/communications"));
    case "src/lib/communications/service.ts":
      return existsSync(join(ROOT, "src/lib/communications/service.ts"));
    case "src/components/platform/crud":
      return existsSync(join(ROOT, "src/components/platform/crud"));
    case "scripts/validate-a11y.mts":
      return existsSync(join(ROOT, "scripts/validate-a11y.mts"));
    case "scripts/validate-mobile.mts":
      return existsSync(join(ROOT, "scripts/validate-mobile.mts"));
    case "scripts/perf-regression.mts":
      return existsSync(join(ROOT, "scripts/perf-regression.mts"));
    case "scripts/bundle-budget.mts":
      return existsSync(join(ROOT, "scripts/bundle-budget.mts"));
    case "scripts/validate-performance.mts":
      return existsSync(join(ROOT, "scripts/validate-performance.mts"));
    case "tests/a11y":
      return existsSync(join(ROOT, "tests/a11y"));
    case "tests/unit/performance":
      return existsSync(join(ROOT, "tests/unit/performance"));
    case "src/lib/observability":
      return existsSync(join(ROOT, "src/lib/observability"));
    case "docs/operations/rc11/01_ACCESSIBILITY.md":
      return existsSync(join(ROOT, "docs/operations/rc11/01_ACCESSIBILITY.md"));
    case "docs/operations/rc11/02_MOBILE.md":
      return existsSync(join(ROOT, "docs/operations/rc11/02_MOBILE.md"));
    case "docs/operations/rc11/03_PERFORMANCE.md":
      return existsSync(join(ROOT, "docs/operations/rc11/03_PERFORMANCE.md"));
    case "docs/operations/rc10/README.md":
      return existsSync(join(ROOT, "docs/operations/rc10/README.md"));
    case "src/app/dashboard/certification/mobile":
      return existsSync(join(ROOT, "src/app/dashboard/certification/mobile"));
    case "src/lib/workflows/extension.ts":
      return existsSync(join(ROOT, "src/lib/workflows/extension.ts"));
    case "src/lib/communications/providers":
      return existsSync(join(ROOT, "src/lib/communications/providers"));
    case "playwright.config.ts":
      return existsSync(join(ROOT, "playwright.config.ts"));
    default:
      return false;
  }
}

function uncached_readPlaywrightConfig(): string {
  try {
    return readFileSync(join(ROOT, "playwright.config.ts"), "utf8");
  } catch {
    return "";
  }
}

type ModuleLibProbe =
  | "dir"
  | "access.ts"
  | "lifecycle/access.ts"
  | "actions.ts"
  | "server-actions.ts"
  | "lifecycle/actions.ts";

function uncached_moduleLibProbe(moduleId: string, probe: ModuleLibProbe): boolean {
  switch (`${moduleId}:${probe}`) {
    case "students:dir":
      return existsSync(join(ROOT, "src/lib/students"));
    case "students:access.ts":
      return existsSync(join(ROOT, "src/lib/students/access.ts"));
    case "students:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/students/lifecycle/access.ts"));
    case "students:actions.ts":
      return existsSync(join(ROOT, "src/lib/students/actions.ts"));
    case "students:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/students/server-actions.ts"));
    case "students:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/students/lifecycle/actions.ts"));
    case "families:dir":
      return existsSync(join(ROOT, "src/lib/families"));
    case "families:access.ts":
      return existsSync(join(ROOT, "src/lib/families/access.ts"));
    case "families:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/families/lifecycle/access.ts"));
    case "families:actions.ts":
      return existsSync(join(ROOT, "src/lib/families/actions.ts"));
    case "families:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/families/server-actions.ts"));
    case "families:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/families/lifecycle/actions.ts"));
    case "communications:dir":
      return existsSync(join(ROOT, "src/lib/communications"));
    case "communications:access.ts":
      return existsSync(join(ROOT, "src/lib/communications/access.ts"));
    case "communications:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/communications/lifecycle/access.ts"));
    case "communications:actions.ts":
      return existsSync(join(ROOT, "src/lib/communications/actions.ts"));
    case "communications:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/communications/server-actions.ts"));
    case "communications:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/communications/lifecycle/actions.ts"));
    case "workflows:dir":
      return existsSync(join(ROOT, "src/lib/workflows"));
    case "workflows:access.ts":
      return existsSync(join(ROOT, "src/lib/workflows/access.ts"));
    case "workflows:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/workflows/lifecycle/access.ts"));
    case "workflows:actions.ts":
      return existsSync(join(ROOT, "src/lib/workflows/actions.ts"));
    case "workflows:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/workflows/server-actions.ts"));
    case "workflows:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/workflows/lifecycle/actions.ts"));
    case "calendar:dir":
      return existsSync(join(ROOT, "src/lib/calendar"));
    case "calendar:access.ts":
      return existsSync(join(ROOT, "src/lib/calendar/access.ts"));
    case "calendar:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/calendar/lifecycle/access.ts"));
    case "calendar:actions.ts":
      return existsSync(join(ROOT, "src/lib/calendar/actions.ts"));
    case "calendar:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/calendar/server-actions.ts"));
    case "calendar:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/calendar/lifecycle/actions.ts"));
    case "admissions:dir":
      return existsSync(join(ROOT, "src/lib/admissions"));
    case "admissions:access.ts":
      return existsSync(join(ROOT, "src/lib/admissions/access.ts"));
    case "admissions:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/admissions/lifecycle/access.ts"));
    case "admissions:actions.ts":
      return existsSync(join(ROOT, "src/lib/admissions/actions.ts"));
    case "admissions:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/admissions/server-actions.ts"));
    case "admissions:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/admissions/lifecycle/actions.ts"));
    case "hr:dir":
      return existsSync(join(ROOT, "src/lib/hr"));
    case "hr:access.ts":
      return existsSync(join(ROOT, "src/lib/hr/access.ts"));
    case "hr:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/hr/lifecycle/access.ts"));
    case "hr:actions.ts":
      return existsSync(join(ROOT, "src/lib/hr/actions.ts"));
    case "hr:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/hr/server-actions.ts"));
    case "hr:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/hr/lifecycle/actions.ts"));
    case "billing:dir":
      return existsSync(join(ROOT, "src/lib/billing"));
    case "billing:access.ts":
      return existsSync(join(ROOT, "src/lib/billing/access.ts"));
    case "billing:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/billing/lifecycle/access.ts"));
    case "billing:actions.ts":
      return existsSync(join(ROOT, "src/lib/billing/actions.ts"));
    case "billing:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/billing/server-actions.ts"));
    case "billing:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/billing/lifecycle/actions.ts"));
    case "scholarships:dir":
      return existsSync(join(ROOT, "src/lib/scholarships"));
    case "scholarships:access.ts":
      return existsSync(join(ROOT, "src/lib/scholarships/access.ts"));
    case "scholarships:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/scholarships/lifecycle/access.ts"));
    case "scholarships:actions.ts":
      return existsSync(join(ROOT, "src/lib/scholarships/actions.ts"));
    case "scholarships:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/scholarships/server-actions.ts"));
    case "scholarships:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/scholarships/lifecycle/actions.ts"));
    case "scheduling:dir":
      return existsSync(join(ROOT, "src/lib/scheduling"));
    case "scheduling:access.ts":
      return existsSync(join(ROOT, "src/lib/scheduling/access.ts"));
    case "scheduling:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/scheduling/lifecycle/access.ts"));
    case "scheduling:actions.ts":
      return existsSync(join(ROOT, "src/lib/scheduling/actions.ts"));
    case "scheduling:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/scheduling/server-actions.ts"));
    case "scheduling:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/scheduling/lifecycle/actions.ts"));
    case "documents:dir":
      return existsSync(join(ROOT, "src/lib/documents"));
    case "documents:access.ts":
      return existsSync(join(ROOT, "src/lib/documents/access.ts"));
    case "documents:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/documents/lifecycle/access.ts"));
    case "documents:actions.ts":
      return existsSync(join(ROOT, "src/lib/documents/actions.ts"));
    case "documents:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/documents/server-actions.ts"));
    case "documents:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/documents/lifecycle/actions.ts"));
    case "founder:dir":
      return existsSync(join(ROOT, "src/lib/founder"));
    case "founder:access.ts":
      return existsSync(join(ROOT, "src/lib/founder/access.ts"));
    case "founder:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/founder/lifecycle/access.ts"));
    case "founder:actions.ts":
      return existsSync(join(ROOT, "src/lib/founder/actions.ts"));
    case "founder:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/founder/server-actions.ts"));
    case "founder:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/founder/lifecycle/actions.ts"));
    case "jag:dir":
      return existsSync(join(ROOT, "src/lib/jag"));
    case "jag:access.ts":
      return existsSync(join(ROOT, "src/lib/jag/access.ts"));
    case "jag:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/jag/lifecycle/access.ts"));
    case "jag:actions.ts":
      return existsSync(join(ROOT, "src/lib/jag/actions.ts"));
    case "jag:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/jag/server-actions.ts"));
    case "jag:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/jag/lifecycle/actions.ts"));
    case "settings:dir":
      return existsSync(join(ROOT, "src/lib/settings"));
    case "settings:access.ts":
      return existsSync(join(ROOT, "src/lib/settings/access.ts"));
    case "settings:lifecycle/access.ts":
      return existsSync(join(ROOT, "src/lib/settings/lifecycle/access.ts"));
    case "settings:actions.ts":
      return existsSync(join(ROOT, "src/lib/settings/actions.ts"));
    case "settings:server-actions.ts":
      return existsSync(join(ROOT, "src/lib/settings/server-actions.ts"));
    case "settings:lifecycle/actions.ts":
      return existsSync(join(ROOT, "src/lib/settings/lifecycle/actions.ts"));
    default:
      return false;
  }
}

function uncached_moduleLibFileExists(moduleId: string, ...parts: string[]): boolean {
  const probe = parts.join("/") as ModuleLibProbe;
  if (
    probe !== "access.ts" &&
    probe !== "lifecycle/access.ts" &&
    probe !== "actions.ts" &&
    probe !== "server-actions.ts" &&
    probe !== "lifecycle/actions.ts"
  ) {
    return false;
  }
  return moduleLibProbe(moduleId, probe);
}

function uncached_moduleLibDirExists(moduleId: string): boolean {
  return moduleLibProbe(moduleId, "dir");
}

function uncached_moduleUiSurfaceExists(moduleId: string): boolean {
  switch (moduleId) {
    case "students":
      return (
        existsSync(join(ROOT, "src/components/students")) ||
        existsSync(join(ROOT, "src/app/dashboard/students"))
      );
    case "families":
      return (
        existsSync(join(ROOT, "src/components/families")) ||
        existsSync(join(ROOT, "src/app/dashboard/families"))
      );
    case "communications":
      return (
        existsSync(join(ROOT, "src/components/communications")) ||
        existsSync(join(ROOT, "src/app/dashboard/communications"))
      );
    case "workflows":
      return (
        existsSync(join(ROOT, "src/components/workflows")) ||
        existsSync(join(ROOT, "src/app/dashboard/workflows"))
      );
    case "calendar":
      return (
        existsSync(join(ROOT, "src/components/calendar")) ||
        existsSync(join(ROOT, "src/app/dashboard/calendar"))
      );
    case "admissions":
      return (
        existsSync(join(ROOT, "src/components/admissions")) ||
        existsSync(join(ROOT, "src/app/dashboard/admissions"))
      );
    case "hr":
      return (
        existsSync(join(ROOT, "src/components/hr")) ||
        existsSync(join(ROOT, "src/app/dashboard/hr"))
      );
    case "billing":
      return (
        existsSync(join(ROOT, "src/components/billing")) ||
        existsSync(join(ROOT, "src/app/dashboard/billing"))
      );
    case "scholarships":
      return (
        existsSync(join(ROOT, "src/components/scholarships")) ||
        existsSync(join(ROOT, "src/app/dashboard/scholarships"))
      );
    case "scheduling":
      return (
        existsSync(join(ROOT, "src/components/scheduling")) ||
        existsSync(join(ROOT, "src/app/dashboard/scheduling"))
      );
    case "documents":
      return (
        existsSync(join(ROOT, "src/components/documents")) ||
        existsSync(join(ROOT, "src/app/dashboard/documents"))
      );
    case "founder":
      return (
        existsSync(join(ROOT, "src/components/founder")) ||
        existsSync(join(ROOT, "src/app/dashboard/founder"))
      );
    case "jag":
      return (
        existsSync(join(ROOT, "src/components/jag")) ||
        existsSync(join(ROOT, "src/app/dashboard/jag"))
      );
    case "settings":
      return (
        existsSync(join(ROOT, "src/components/settings")) ||
        existsSync(join(ROOT, "src/app/dashboard/settings"))
      );
    default:
      return false;
  }
}

function uncached_testPathHasFiles(rel: string): boolean {
  switch (rel) {
    case "tests/unit/students":
      return dirHasSourceFiles(join(ROOT, "tests/unit/students"));
    case "tests/unit/families":
      return dirHasSourceFiles(join(ROOT, "tests/unit/families"));
    case "tests/unit/communications":
      return dirHasSourceFiles(join(ROOT, "tests/unit/communications"));
    case "tests/unit/workflows":
      return dirHasSourceFiles(join(ROOT, "tests/unit/workflows"));
    case "tests/unit/calendar":
      return dirHasSourceFiles(join(ROOT, "tests/unit/calendar"));
    case "tests/unit/admissions":
      return dirHasSourceFiles(join(ROOT, "tests/unit/admissions"));
    case "tests/integration":
      return dirHasSourceFiles(join(ROOT, "tests/integration"));
    case "tests/unit/hr":
      return dirHasSourceFiles(join(ROOT, "tests/unit/hr"));
    case "tests/unit/employees":
      return dirHasSourceFiles(join(ROOT, "tests/unit/employees"));
    case "tests/unit/hr-platform":
      return dirHasSourceFiles(join(ROOT, "tests/unit/hr-platform"));
    case "tests/unit/billing":
      return dirHasSourceFiles(join(ROOT, "tests/unit/billing"));
    case "tests/unit/finance":
      return dirHasSourceFiles(join(ROOT, "tests/unit/finance"));
    case "tests/unit/finance-platform":
      return dirHasSourceFiles(join(ROOT, "tests/unit/finance-platform"));
    case "tests/unit/scholarships":
      return dirHasSourceFiles(join(ROOT, "tests/unit/scholarships"));
    case "tests/unit/scheduling":
      return dirHasSourceFiles(join(ROOT, "tests/unit/scheduling"));
    case "tests/unit/documents":
      return dirHasSourceFiles(join(ROOT, "tests/unit/documents"));
    case "tests/unit/founder-intelligence":
      return dirHasSourceFiles(join(ROOT, "tests/unit/founder-intelligence"));
    case "tests/unit/jag-intelligence":
      return dirHasSourceFiles(join(ROOT, "tests/unit/jag-intelligence"));
    default:
      return false;
  }
}

function uncached_readMigrationSqlFiles(): string[] {
  const migrationDir = join(ROOT, "supabase", "migrations");
  if (!existsSync(migrationDir)) return [];
  try {
    return readdirSync(migrationDir)
      .filter((f) => f.endsWith(".sql") && !f.includes("..") && !f.includes("/") && !f.includes("\\"))
      .map((f) => {
        try {
          return readFileSync(join(migrationDir, f), "utf8");
        } catch {
          return "";
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/* ---------------------------------------------------------------------------
 * Cached public surface.
 *
 * Each wrapper keys on exactly the arguments its reader uses, so two different
 * questions can never share an answer. `moduleLibFileExists` joins its variadic
 * parts with "/" -- the same characters the path itself uses -- rather than
 * with a separator that could collide with a module id.
 * ------------------------------------------------------------------------- */

export function moduleDocsExist(docsPath: string): boolean {
  return memo(`docsExist:${docsPath}`, () => uncached_moduleDocsExist(docsPath));
}

export function readModuleDocs(docsPath: string): string | null {
  return memo(`docs:${docsPath}`, () => uncached_readModuleDocs(docsPath));
}

export function repoFileExists(relPath: string): boolean {
  return memo(`repoFile:${relPath}`, () => uncached_repoFileExists(relPath));
}

export function readPlaywrightConfig(): string {
  return memo("playwrightConfig", () => uncached_readPlaywrightConfig());
}

export function moduleLibProbe(moduleId: string, probe: ModuleLibProbe): boolean {
  return memo(`libProbe:${moduleId}:${probe}`, () =>
    uncached_moduleLibProbe(moduleId, probe)
  );
}

export function moduleLibFileExists(moduleId: string, ...parts: string[]): boolean {
  return memo(`libFile:${moduleId}:${parts.join("/")}`, () =>
    uncached_moduleLibFileExists(moduleId, ...parts)
  );
}

export function moduleLibDirExists(moduleId: string): boolean {
  return memo(`libDir:${moduleId}`, () => uncached_moduleLibDirExists(moduleId));
}

export function moduleUiSurfaceExists(moduleId: string): boolean {
  return memo(`uiSurface:${moduleId}`, () => uncached_moduleUiSurfaceExists(moduleId));
}

export function testPathHasFiles(rel: string): boolean {
  return memo(`testPath:${rel}`, () => uncached_testPathHasFiles(rel));
}

export function readMigrationSqlFiles(): string[] {
  return memo("migrationSql", () => uncached_readMigrationSqlFiles());
}
