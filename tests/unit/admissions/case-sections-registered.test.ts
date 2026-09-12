import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ADMISSIONS_CASE_PROFILE_SECTIONS } from "@/lib/admissions/profile/sections";

/**
 * A case section lives in two places and has to be added to both.
 *
 * `ADMISSIONS_CASE_PROFILE_SECTIONS` defines the tab and loads its data.
 * `AdmissionsCaseSectionSwitch` decides what to draw — a static switch rather
 * than a registry lookup, because resolving a "use client" section through the
 * runtime registry breaks the RSC client boundary in a production build.
 *
 * Add the definition and forget the switch and the tab appears, loads its data,
 * and renders "Section module is not registered" — a sentence no member of
 * staff can act on, and one that looks like a broken feature rather than a
 * missing line. That is how the Student Questionnaire shipped.
 *
 * This reads the switch as source rather than importing it, because importing a
 * file full of JSX section components into a unit test pulls in half the design
 * system for no benefit. The check is crude and it is exact.
 */
describe("every case section can actually render", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "src/components/admissions/case/sections/AdmissionsCaseSectionSwitch.tsx"
    ),
    "utf8"
  );

  const switchKeys = new Set(
    [...source.matchAll(/case "([a-z_]+)":/g)].map((match) => match[1])
  );

  it("has a case in the switch for each defined section", () => {
    const defined = ADMISSIONS_CASE_PROFILE_SECTIONS.map((section) => section.key);
    const missing = defined.filter((key) => !switchKeys.has(key));
    expect(missing, `sections with no case in AdmissionsCaseSectionSwitch: ${missing.join(", ")}`)
      .toEqual([]);
  });

  it("has no case in the switch for a section nobody defines", () => {
    const defined = new Set(ADMISSIONS_CASE_PROFILE_SECTIONS.map((s) => s.key));
    const orphans = [...switchKeys].filter((key) => !defined.has(key));
    expect(orphans, `switch cases with no section definition: ${orphans.join(", ")}`).toEqual([]);
  });

  it("includes the student questionnaire, which is what caught this", () => {
    expect(switchKeys.has("student_questionnaire")).toBe(true);
  });
});
