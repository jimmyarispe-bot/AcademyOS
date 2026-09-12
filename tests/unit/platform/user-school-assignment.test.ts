import { describe, expect, it } from "vitest";

/**
 * Setting somebody's schools is a diff, not an insert.
 *
 * The bug this guards: "Assign School" upserted each ticked school and removed
 * nothing, while the dialog rendered every box unticked regardless of what the
 * person already had. Ticking one school read as "their access is now this
 * school" and meant "also give them this school". A School Leader assigned to
 * the wrong campus kept it, and no screen in the product could take it back.
 *
 * The logic under test is the diff itself, extracted here so it can be checked
 * without a database: given what somebody holds and what was ticked, what is
 * added and what is removed.
 */
function planSchoolChanges(held: string[], wanted: string[]) {
  const heldSet = new Set(held);
  const wantedSet = new Set(wanted);
  return {
    add: [...wantedSet].filter((id) => !heldSet.has(id)),
    remove: [...heldSet].filter((id) => !wantedSet.has(id)),
  };
}

const FL = "school-fl";
const GA = "school-ga";
const HS = "school-hs";

describe("setting a person's schools", () => {
  it("adds a school they do not have", () => {
    expect(planSchoolChanges([FL], [FL, GA])).toEqual({ add: [GA], remove: [] });
  });

  /** Nina Gaddy, 12 September: assigned to GA, came out with GA and FL. */
  it("removes the school that was there before — the actual bug", () => {
    expect(planSchoolChanges([FL], [GA])).toEqual({ add: [GA], remove: [FL] });
  });

  it("does nothing when nothing changed", () => {
    expect(planSchoolChanges([FL, GA], [GA, FL])).toEqual({ add: [], remove: [] });
  });

  /**
   * Revoking every school is a legitimate administrative act, so an empty
   * selection removes rather than being treated as "no change". The dialog
   * shows the person's current schools before submitting, which is what makes
   * an empty list a decision rather than an accident.
   */
  it("treats an empty selection as no access, not as no change", () => {
    expect(planSchoolChanges([FL, GA], [])).toEqual({ add: [], remove: [FL, GA] });
  });

  it("grants from nothing", () => {
    expect(planSchoolChanges([], [FL, GA, HS])).toEqual({
      add: [FL, GA, HS],
      remove: [],
    });
  });

  it("ignores a school ticked twice", () => {
    expect(planSchoolChanges([FL], [GA, GA])).toEqual({ add: [GA], remove: [FL] });
  });
});
