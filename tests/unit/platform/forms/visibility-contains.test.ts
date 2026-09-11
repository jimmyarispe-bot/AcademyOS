import { describe, expect, it } from "vitest";
import { evaluateFormConditions } from "@/lib/platform/forms/visibility";

/**
 * `contains` exists because a multiselect answer cannot be tested by any of the
 * operators that came before it.
 *
 * A multiselect arrives as an array. `eq` compares it to a string and is never
 * true. `in` asks whether the ANSWER appears in a list supplied by the rule,
 * which is the opposite question. So "did this Georgia family tick GA GOAL?"
 * was unanswerable, and the GOAL eligibility questions would have had to show
 * for every Georgia family whether they were applying for it or not.
 */
describe("evaluateFormConditions — contains", () => {
  const rule = {
    all: [{ path: "ga_scholarships", op: "contains" as const, value: "ga_goal" }],
  };

  it("is true when the list holds the value", () => {
    expect(
      evaluateFormConditions(rule, { ga_scholarships: ["ga_special_needs", "ga_goal"] })
    ).toBe(true);
  });

  it("is false when the list does not", () => {
    expect(evaluateFormConditions(rule, { ga_scholarships: ["ga_special_needs"] })).toBe(
      false
    );
  });

  it("is false for an empty list, and for no answer at all", () => {
    expect(evaluateFormConditions(rule, { ga_scholarships: [] })).toBe(false);
    expect(evaluateFormConditions(rule, {})).toBe(false);
  });

  it("is false — not a crash — when the answer is not a list", () => {
    // A question changed from select to multiselect leaves older submissions
    // holding a bare string. Hiding the dependent question is the safe read.
    expect(evaluateFormConditions(rule, { ga_scholarships: "ga_goal" })).toBe(false);
  });

  it("compares as strings, so a numeric option value still matches", () => {
    expect(
      evaluateFormConditions(
        { all: [{ path: "years", op: "contains", value: 2 }] },
        { years: ["1", "2"] }
      )
    ).toBe(true);
  });

  it("does not confuse contains with in", () => {
    // `in` asks whether the answer appears in a list on the rule.
    expect(
      evaluateFormConditions(
        { all: [{ path: "stage", op: "in", value: ["applied", "enrolled"] }] },
        { stage: "applied" }
      )
    ).toBe(true);
    // `contains` asks whether a list on the answer holds the rule's value.
    expect(
      evaluateFormConditions(
        { all: [{ path: "stage", op: "contains", value: "applied" }] },
        { stage: "applied" }
      )
    ).toBe(false);
  });
});
