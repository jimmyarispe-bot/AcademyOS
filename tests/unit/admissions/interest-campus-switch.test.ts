import { describe, expect, it } from "vitest";
import {
  isSectionVisible,
  pruneAnswersForHiddenSections,
} from "@/lib/admissions/interest-form/definition";
import type { InterestFormDefinition } from "@/lib/admissions/interest-form/types";

const GA = "11111111-1111-4111-8111-111111111111";
const HS = "22222222-2222-4222-8222-222222222222";

/**
 * A cut-down copy of the shape that shipped: one campus section gated on the
 * school, and one section gated only on an answer given inside it.
 */
const definition: InterestFormDefinition = {
  schemaVersion: "interest_form.v1",
  title: "Test",
  sections: [
    {
      key: "program_school",
      title: "School",
      order: 0,
      questionKeys: ["school_id"],
    },
    {
      key: "ga_detail",
      title: "The Academy GA",
      order: 1,
      visibleWhen: { all: [{ path: "school_id", op: "eq", value: GA }] },
      questionKeys: ["ga_scholarships"],
    },
    {
      key: "ga_goal",
      title: "GA GOAL — eligibility",
      order: 2,
      visibleWhen: {
        all: [
          { path: "school_id", op: "eq", value: GA },
          { path: "ga_scholarships", op: "contains", value: "ga_goal" },
        ],
      },
      questionKeys: ["ga_goal_income_document"],
    },
    {
      key: "hs_detail",
      title: "The Academy HS",
      order: 3,
      visibleWhen: { all: [{ path: "school_id", op: "eq", value: HS }] },
      questionKeys: ["hs_student_email"],
    },
  ],
  questions: [
    { key: "school_id", type: "school_selector", label: "School", required: true, order: 0 },
    { key: "ga_scholarships", type: "multiselect", label: "Scholarships", required: false, order: 1 },
    { key: "ga_goal_income_document", type: "file", label: "Proof of income", required: true, order: 2 },
    { key: "hs_student_email", type: "email", label: "Student email", required: false, order: 3 },
  ],
};

function sectionVisible(key: string, values: Record<string, unknown>) {
  const section = definition.sections.find((s) => s.key === key)!;
  return isSectionVisible(section, values);
}

/**
 * The bug: a parent looked at Georgia, ticked GA GOAL, then changed the school
 * selector to the high school. `ga_scholarships` stayed in browser state, and
 * the GOAL section — which at the time asked only whether GOAL was ticked —
 * stayed on screen with its required uploads, on the wrong campus's form.
 *
 * Two independent guards, because either alone would have prevented it and
 * neither alone is enough for the next section somebody adds.
 */
describe("switching campus mid-form", () => {
  const afterGeorgia = {
    school_id: GA,
    ga_scholarships: ["ga_goal"],
    ga_goal_income_document: "interest-uploads/0f8fad5b-d9cb-469f-a165-70867728950e.pdf",
  };

  it("shows the GOAL section while Georgia is the chosen campus", () => {
    expect(sectionVisible("ga_goal", afterGeorgia)).toBe(true);
  });

  it("closes the GOAL section on another campus even with the tick left behind", () => {
    expect(sectionVisible("ga_goal", { ...afterGeorgia, school_id: HS })).toBe(false);
  });

  it("forgets the Georgia answers when the campus changes", () => {
    const pruned = pruneAnswersForHiddenSections(definition, {
      ...afterGeorgia,
      school_id: HS,
    });
    expect(pruned.school_id).toBe(HS);
    expect("ga_scholarships" in pruned).toBe(false);
    expect("ga_goal_income_document" in pruned).toBe(false);
  });

  it("cascades: clearing the tick is what closes the section it gates", () => {
    // ga_goal is reachable only because ga_scholarships survived. Prune the
    // campus section first and the answer-gated one must follow on a later pass.
    const pruned = pruneAnswersForHiddenSections(definition, {
      school_id: HS,
      ga_scholarships: ["ga_goal"],
      ga_goal_income_document: "interest-uploads/0f8fad5b-d9cb-469f-a165-70867728950e.pdf",
    });
    expect(Object.keys(pruned)).toEqual(["school_id"]);
  });

  it("leaves the answers of a campus the family is still on", () => {
    const values = { school_id: GA, ga_scholarships: ["ga_goal"] };
    expect(pruneAnswersForHiddenSections(definition, values)).toEqual(values);
  });

  it("returns the same object when there is nothing to prune", () => {
    const values = { school_id: HS, hs_student_email: "a@b.com" };
    expect(pruneAnswersForHiddenSections(definition, values)).toBe(values);
  });
});
