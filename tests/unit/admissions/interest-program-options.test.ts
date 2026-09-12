import { describe, expect, it } from "vitest";
import { validateInterestSubmission } from "@/lib/admissions/interest-form/definition";
import type { InterestFormDefinition } from "@/lib/admissions/interest-form/types";
import { allowedInterestProgramTypes } from "@/lib/admissions/interest-form/program-options";

const SCHOOL = "11111111-1111-4111-8111-111111111111";

function definitionWith(options?: { value: string; label: string }[]): InterestFormDefinition {
  return {
    schemaVersion: "interest_form.v1",
    title: "Test",
    sections: [
      { key: "s", title: "S", order: 0, questionKeys: ["school_id", "program"] },
    ],
    questions: [
      { key: "school_id", type: "school_selector", label: "School", required: true, order: 0 },
      {
        key: "program",
        type: "program_selector",
        label: "Program",
        required: false,
        order: 1,
        ...(options ? { options } : {}),
      },
    ],
  };
}

function submit(definition: InterestFormDefinition, program: unknown) {
  return validateInterestSubmission({
    definition,
    values: { school_id: SCHOOL, program },
    schoolIds: new Set([SCHOOL]),
    programCodesForSchool: allowedInterestProgramTypes(),
    claimedFormVersionId: null,
    publishedFormVersionId: null,
  });
}

const HS_OPTIONS = [
  { value: "Only Virtual", label: "Only Virtual" },
  { value: "Hybrid (in-person + virtual)", label: "Hybrid (in-person + virtual)" },
];

/**
 * The high school runs two of the network's five programme types. Its question
 * says so — and the server has to agree, or the page shows two choices while a
 * posted form can still record interest in a programme the campus does not run.
 * Nobody testing by hand would find that, because nobody testing by hand posts
 * the form directly.
 */
describe("a program question that narrows the list", () => {
  const narrowed = definitionWith(HS_OPTIONS);

  it("accepts a programme the campus runs", () => {
    const result = submit(narrowed, ["Only Virtual"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visibleValues.program).toEqual(["Only Virtual"]);
  });

  it("accepts both of them together", () => {
    expect(submit(narrowed, ["Only Virtual", "Hybrid (in-person + virtual)"]).ok).toBe(true);
  });

  it("refuses one the campus does not run, even though the network does", () => {
    expect(submit(narrowed, ["Tutoring"]).ok).toBe(false);
    expect(submit(narrowed, ["In-Person"]).ok).toBe(false);
    expect(submit(narrowed, ["Full-School Program"]).ok).toBe(false);
  });

  it("refuses a valid choice smuggled in alongside an invalid one", () => {
    expect(submit(narrowed, ["Only Virtual", "Tutoring"]).ok).toBe(false);
  });
});

/**
 * Every other campus says nothing, and gets the network's five.
 */
describe("a program question that does not narrow the list", () => {
  const open = definitionWith();

  it("accepts any of the network types", () => {
    for (const value of allowedInterestProgramTypes()) {
      expect(submit(open, [value]).ok, value).toBe(true);
    }
  });

  it("still refuses something invented", () => {
    expect(submit(open, ["Boarding"]).ok).toBe(false);
  });

  it("accepts an empty answer", () => {
    const result = submit(open, []);
    expect(result.ok).toBe(true);
  });
});
