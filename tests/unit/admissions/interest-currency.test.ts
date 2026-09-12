import { describe, expect, it } from "vitest";
import { validateInterestSubmission } from "@/lib/admissions/interest-form/definition";
import type { InterestFormDefinition } from "@/lib/admissions/interest-form/types";

const SCHOOL = "11111111-1111-4111-8111-111111111111";

const definition: InterestFormDefinition = {
  schemaVersion: "interest_form.v1",
  title: "Test",
  sections: [{ key: "s", title: "S", order: 0, questionKeys: ["school_id", "award"] }],
  questions: [
    { key: "school_id", type: "school_selector", label: "School", required: true, order: 0 },
    { key: "award", type: "currency", label: "Award amount", required: false, order: 1 },
  ],
};

function submit(award: unknown) {
  return validateInterestSubmission({
    definition,
    values: { school_id: SCHOOL, award },
    schoolIds: new Set([SCHOOL]),
    programCodesForSchool: [],
    claimedFormVersionId: null,
    publishedFormVersionId: null,
  });
}

describe("currency answers", () => {
  it("accepts a figure copied straight off an award letter", () => {
    // Number("$10,463.00") is NaN. Rejecting a correctly-read figure for its
    // punctuation is how a form loses a family who did nothing wrong.
    const result = submit("$10,463.00");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visibleValues.award).toBe(10463);
  });

  it("accepts a plain number", () => {
    const result = submit("7500");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visibleValues.award).toBe(7500);
  });

  it("keeps the decimal", () => {
    const result = submit("2,479.16");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visibleValues.award).toBe(2479.16);
  });

  it("stores a number, not the string the parent typed", () => {
    const result = submit("$1,000");
    if (result.ok) expect(typeof result.visibleValues.award).toBe("number");
  });

  it("still rejects something that is not a figure at all", () => {
    const result = submit("about ten thousand");
    expect(result.ok).toBe(false);
  });
});
