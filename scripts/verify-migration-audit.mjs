#!/usr/bin/env node
/**
 * Verification audit: compare migration-defined schema objects against remote DB.
 * Run: node scripts/verify-migration-audit.mjs
 * Requires: supabase CLI linked to remote project.
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

function query(sql) {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  const out = execSync(`supabase db query --linked -o json ${JSON.stringify(oneLine)}`, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const start = out.indexOf("[");
  const end = out.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error(`Unexpected query output:\n${out}`);
  }
  return JSON.parse(out.slice(start, end + 1));
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function parseMigrations(files) {
  const functions = new Set();
  const policies = new Set(); // table|policy
  const droppedPolicies = new Set();
  const triggers = new Set(); // table|trigger
  const views = new Set();
  const tables = new Set();
  const permissionTables = new Set(["platform_permissions", "platform_role_permissions"]);

  for (const file of files) {
    const raw = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const sql = stripComments(raw);

    for (const m of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi
    )) {
      functions.add(m[1].toLowerCase());
    }

    for (const m of sql.matchAll(
      /drop\s+policy\s+if\s+exists\s+([a-z_][a-z0-9_]*)\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi
    )) {
      const key = `${m[2].toLowerCase()}|${m[1].toLowerCase()}`;
      policies.delete(key);
      droppedPolicies.add(key);
    }

    for (const m of sql.matchAll(
      /create\s+policy\s+([a-z_][a-z0-9_]*)\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi
    )) {
      policies.add(`${m[2].toLowerCase()}|${m[1].toLowerCase()}`);
    }

    for (const m of sql.matchAll(
      /create\s+trigger\s+([a-z_][a-z0-9_]*)\s+(?:before|after|instead\s+of)\s+/gi
    )) {
      triggers.add(m[1].toLowerCase());
    }

    for (const m of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi
    )) {
      views.add(m[1].toLowerCase());
    }

    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi
    )) {
      const name = m[1].toLowerCase();
      tables.add(name);
      if (name.includes("permission")) permissionTables.add(name);
    }
  }

  return { functions, policies, triggers, views, tables, permissionTables, droppedPolicies };
}

function scanEnterpriseRoutes() {
  const appDir = join(ROOT, "src", "app");
  const routes = [];
  const issues = [];

  function walk(dir, prefix) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, `${prefix}/${entry.name}`);
      } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
        routes.push(prefix || "/");
        const layoutPath = join(dir, "..", "layout.tsx");
        const pageContent = readFileSync(full, "utf8");
        const layoutCandidates = [
          join(dir, "layout.tsx"),
          join(dir, "..", "layout.tsx"),
          join(dir, "..", "..", "layout.tsx"),
          join(dir, "..", "..", "..", "layout.tsx"),
          join(appDir, "dashboard", "layout.tsx"),
          join(appDir, "cloud", "layout.tsx"),
          join(appDir, "operations", "layout.tsx"),
        ];
        const hasGuard =
          /requirePagePermission|requireCloudPermission|requireOperationsPermission|requireAuthenticatedIdentity|getIdentityContext|redirect\(\s*["']\/login|canAccess|canView|page-guard/i.test(
            pageContent
          ) ||
          layoutCandidates.some(
            (p) =>
              existsSync(p) &&
              /requirePagePermission|requireCloudPermission|requireOperationsPermission|getIdentityContext|canAccess|canView|page-guard|redirect\(\s*["']\/login/i.test(
                readFileSync(p, "utf8")
              )
          );

        const isPublic =
          prefix.startsWith("/login") ||
          prefix === "/" ||
          prefix.startsWith("/apply") ||
          prefix.startsWith("/portal");

        if (!isPublic && !hasGuard) {
          issues.push({ route: prefix, issue: "No obvious permission guard in page or parent layout" });
        }
      }
    }
  }

  for (const segment of ["dashboard", "cloud", "operations"]) {
    walk(join(appDir, segment), `/${segment}`);
  }

  return { routes, issues };
}

function diff(expectedSet, actualSet, label) {
  const missing = [...expectedSet].filter((x) => !actualSet.has(x)).sort();
  const extra = [...actualSet].filter((x) => !expectedSet.has(x)).sort();
  return { label, expected: expectedSet.size, actual: actualSet.size, missing, extra };
}

async function main() {
  const files = migrationFiles();
  const expected = parseMigrations(files);

  const fnRows = query(`
    SELECT lower(p.proname) AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  `);

  const policyRows = query(`
    SELECT lower(tablename) AS table_name, lower(policyname) AS policy_name
    FROM pg_policies
    WHERE schemaname = 'public'
  `);

  const triggerRows = query(`
    SELECT lower(t.tgname) AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
  `);

  const viewRows = query(`
    SELECT lower(table_name) AS view_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  `);

  const tableRows = query(`
    SELECT lower(tablename) AS table_name
    FROM pg_tables
    WHERE schemaname = 'public'
  `);

  const rpcRows = query(`
    SELECT lower(p.proname) AS name
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  `);

  const actualFunctions = new Set(fnRows.map((r) => r.name));
  const actualPolicies = new Set(policyRows.map((r) => `${r.table_name}|${r.policy_name}`));
  const actualTriggers = new Set(triggerRows.map((r) => r.trigger_name));
  const actualViews = new Set(viewRows.map((r) => r.view_name));
  const actualTables = new Set(tableRows.map((r) => r.table_name));
  const actualRpc = new Set(rpcRows.map((r) => r.name));

  const fnDiff = diff(expected.functions, actualFunctions, "functions");
  const policyDiff = diff(expected.policies, actualPolicies, "policies");
  const triggerDiff = diff(expected.triggers, actualTriggers, "triggers");
  const viewDiff = diff(expected.views, actualViews, "views");

  const missingPermissionTables = [...expected.permissionTables].filter(
    (t) => !actualTables.has(t)
  );

  const missingRpc = [...expected.functions].filter((f) => !actualRpc.has(f));

  const { routes, issues: routeIssues } = scanEnterpriseRoutes();

  const report = {
    migrationsParsed: files.length,
    migrationRange: `${files[0]?.slice(0, 3)}–${files.at(-1)?.slice(0, 3)}`,
    functions: fnDiff,
    policies: {
      ...policyDiff,
      superseded: [...expected.droppedPolicies].sort(),
    },
    triggers: triggerDiff,
    views: viewDiff,
    permissionTables: {
      expected: [...expected.permissionTables].sort(),
      missing: missingPermissionTables,
    },
    rpc: {
      expectedFunctionCount: expected.functions.size,
      grantedRpcCount: actualRpc.size,
      migrationFunctionsMissingGrant: missingRpc.slice(0, 50),
      migrationFunctionsMissingGrantTotal: missingRpc.length,
    },
    enterpriseRoutes: {
      count: routes.length,
      unguarded: routeIssues,
    },
    ok:
      fnDiff.missing.length === 0 &&
      policyDiff.missing.length === 0 &&
      triggerDiff.missing.length === 0 &&
      viewDiff.missing.length === 0 &&
      missingPermissionTables.length === 0,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
