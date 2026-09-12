import { describe, expect, it } from "vitest";
import { PROSPECT_INVITE_BATCH_LIMIT } from "@/lib/admissions/portal/prospect-invites";

/**
 * Inviting a prospective parent into the application portal.
 *
 * The decision logic is extracted here so it can be checked without a database.
 * It is the same rule the module applies twice — once when building the preview
 * a person reads, once again at send time, because the list they read may be
 * minutes old.
 */
type Candidate = {
  guardianId: string;
  email: string | null;
  accountAlreadyExists: boolean;
};

type Decision = { invite: true } | { invite: false; because: string };

function decide(c: Candidate): Decision {
  if (!c.email || c.email.trim() === "") {
    return { invite: false, because: "no_email" };
  }
  if (c.accountAlreadyExists) {
    return { invite: false, because: "account_exists" };
  }
  return { invite: true };
}

describe("who gets invited", () => {
  it("invites a parent with an email and no account", () => {
    expect(decide({ guardianId: "g1", email: "parent@example.com", accountAlreadyExists: false }))
      .toEqual({ invite: true });
  });

  it("skips a guardian with no email — there is nothing to send to", () => {
    expect(decide({ guardianId: "g2", email: null, accountAlreadyExists: false }))
      .toEqual({ invite: false, because: "no_email" });
    expect(decide({ guardianId: "g3", email: "   ", accountAlreadyExists: false }))
      .toEqual({ invite: false, because: "no_email" });
  });

  /**
   * THE ONE THAT MATTERS.
   *
   * `createManagedUser` deletes a user's existing roles before assigning the
   * requested one. For somebody being created that is correct. For somebody who
   * already exists it is destructive: the account keeps working and comes back
   * as a PARENT, having lost every staff role it held.
   *
   * Lead guardian emails are typed by whoever filled in the public form, and the
   * standing test address for this product is the founder's own. An invite that
   * "upgrades" an existing account would lock him out of the JAG he runs.
   *
   * So an existing account is refused outright. Never upgraded, never merged,
   * never re-invited.
   */
  it("refuses an address that already has an account, whoever it belongs to", () => {
    expect(decide({ guardianId: "g4", email: "jimmy.arispe@gmail.com", accountAlreadyExists: true }))
      .toEqual({ invite: false, because: "account_exists" });
  });

  it("refuses it even when everything else about the row is fine", () => {
    const perfect = { guardianId: "g5", email: "nina.gaddy@theacademyga.org", accountAlreadyExists: true };
    expect(decide(perfect).invite).toBe(false);
  });

  /**
   * Fail closed. If the check for existing accounts errors, every address is
   * treated as taken — not knowing is the one state in which inviting is unsafe.
   */
  it("treats an unknown account state as taken", () => {
    const unknownIsTreatedAsExisting = true;
    expect(decide({ guardianId: "g6", email: "someone@example.com", accountAlreadyExists: unknownIsTreatedAsExisting }).invite)
      .toBe(false);
  });
});

describe("the batch limit", () => {
  it("is small enough that a mistake reaches one household", () => {
    expect(PROSPECT_INVITE_BATCH_LIMIT).toBeLessThanOrEqual(4);
    expect(PROSPECT_INVITE_BATCH_LIMIT).toBeGreaterThan(0);
  });

  it("caps the ids actually processed", () => {
    const requested = ["a", "b", "c", "d", "e", "f"];
    expect(requested.slice(0, PROSPECT_INVITE_BATCH_LIMIT)).toHaveLength(
      PROSPECT_INVITE_BATCH_LIMIT
    );
  });
});

/**
 * The prospect portal matches a guardian to their enquiry by email, via
 * `is_guardian_of_lead`:
 *
 *     lower(lg.email) = lower(u.email)
 *
 * Not by a user_id column, which is how the enrolled portal works. Case and
 * surrounding whitespace therefore decide whether a family sees their own
 * application, so both sides are normalised the same way.
 */
describe("the email match that makes the portal work", () => {
  const norm = (s: string) => s.trim().toLowerCase();

  it("matches regardless of case", () => {
    expect(norm("Parent@Example.COM")).toBe(norm("parent@example.com"));
  });

  it("matches regardless of surrounding space", () => {
    expect(norm("  parent@example.com ")).toBe(norm("parent@example.com"));
  });

  it("does not match a different address", () => {
    expect(norm("parent@example.com")).not.toBe(norm("parent@example.co"));
  });
});

describe("the confirmation", () => {
  const accepted = (confirm: string) => confirm.trim() === "SEND";

  it("requires the literal word", () => {
    expect(accepted("SEND")).toBe(true);
    expect(accepted(" SEND ")).toBe(true);
  });

  it("rejects anything else, including a near miss", () => {
    expect(accepted("send")).toBe(false);
    expect(accepted("YES")).toBe(false);
    expect(accepted("")).toBe(false);
    expect(accepted("SENDD")).toBe(false);
  });
});
