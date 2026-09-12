import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STUDENT_PROFILE_SECTIONS } from "@/lib/students/profile/sections";

/**
 * A student section lives in two places and has to be added to both.
 *
 * `STUDENT_PROFILE_SECTIONS` defines the tab and loads its data.
 * `SECTION_COMPONENT_LOADERS` says what to draw. The registration loop skips
 * any section with no loader — `if (!componentLoader) continue;` — so a section
 * defined and not registered does not fail, warn, or appear. It simply is not
 * there, and the person who added it has no way to tell whether they made a
 * mistake or the tab is somewhere they have not looked.
 *
 * The admissions case had the same shape and cost a shipped feature that
 * rendered "Section module is not registered". This is the student profile's
 * copy of that guard.
 *
 * Read as source rather than imported: the loaders are dynamic imports of
 * modules full of JSX, and running them in a unit test drags in half the
 * design system to prove a key exists.
 */
describe("every student section can actually render", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/lib/students/profile/sections/register-modules.ts"),
    "utf8"
  );

  const block = source.slice(
    source.indexOf("SECTION_COMPONENT_LOADERS"),
    source.indexOf("export function registerStudentProfileSectionModules")
  );
  const loaderKeys = new Set(
    [...block.matchAll(/^\s{2}"?([a-z0-9-]+)"?:\s*\(\)\s*=>/gm)].map((m) => m[1])
  );

  it("found the loader map", () => {
    expect(loaderKeys.size).toBeGreaterThan(10);
  });

  it("has a component loader for each defined section", () => {
    const defined = STUDENT_PROFILE_SECTIONS.map((section) => section.key);
    const missing = defined.filter((key) => !loaderKeys.has(key));
    expect(missing, `sections with no component loader: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no loader for a section nobody defines", () => {
    const defined = new Set(STUDENT_PROFILE_SECTIONS.map((s) => s.key));
    const orphans = [...loaderKeys].filter((key) => !defined.has(key));
    expect(orphans, `loaders with no section definition: ${orphans.join(", ")}`).toEqual([]);
  });

  it("includes notes, which the student profile went without for a year", () => {
    expect(loaderKeys.has("notes")).toBe(true);
    expect(STUDENT_PROFILE_SECTIONS.some((s) => s.key === "notes")).toBe(true);
  });
});
