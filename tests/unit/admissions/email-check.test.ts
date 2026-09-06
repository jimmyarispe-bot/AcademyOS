import { describe, expect, it } from "vitest";

import { checkEmailAddress } from "@/lib/admissions/email-check";

/**
 * The two cases at the top are not hypothetical. They are the addresses that
 * were in production on 6 September 2026, both of which passed the interest
 * form's validation, and one of which delivered a family's information to a
 * stranger for two weeks.
 */

describe("the addresses that actually got through", () => {
  it("catches turpincasey@yahoo.con", () => {
    const result = checkEmailAddress("turpincasey@yahoo.con");
    expect(result.kind).toBe("suggest");
    if (result.kind === "suggest") {
      expect(result.suggestion).toBe("turpincasey@yahoo.com");
    }
  });

  it("catches amiysha06@gmial.com — the one that did NOT bounce", () => {
    const result = checkEmailAddress("amiysha06@gmial.com");
    expect(result.kind).toBe("suggest");
    if (result.kind === "suggest") {
      expect(result.suggestion).toBe("amiysha06@gmail.com");
    }
  });

  it("catches r.mourdia@gmail.con", () => {
    const result = checkEmailAddress("r.mourdia@gmail.con");
    expect(result.kind).toBe("suggest");
    if (result.kind === "suggest") {
      expect(result.suggestion).toBe("r.mourdia@gmail.com");
    }
  });

  it("passes the address that only LOOKED wrong — whitespace, not spelling", () => {
    expect(checkEmailAddress("  amiysha06@gmail.com  ").kind).toBe("ok");
  });
});

describe("common typos", () => {
  const cases: Array<[string, string]> = [
    ["a@gmai.com", "a@gmail.com"],
    ["a@gmial.com", "a@gmail.com"],
    ["a@gmail.co,", "a@gmail.com"],
    ["a@yahooo.com", "a@yahoo.com"],
    ["a@hotmial.com", "a@hotmail.com"],
    ["a@outlok.com", "a@outlook.com"],
    ["a@iclould.com", "a@icloud.com"],
    ["a@comcast.ne", "a@comcast.net"],
    ["a@example.cmo", "a@example.com"],
    // Not a Google domain. One letter from one that is.
    ["someone@gmail.co", "someone@gmail.com"],
    // The address actually in production: a dropped letter, length 18.
    ["amiysha06@gmil.com", "amiysha06@gmail.com"],
  ];

  for (const [input, expected] of cases) {
    it(`${input} -> ${expected}`, () => {
      const result = checkEmailAddress(input);
      expect(result.kind).toBe("suggest");
      if (result.kind === "suggest") expect(result.suggestion).toBe(expected);
    });
  }
});

describe("what it must NOT complain about", () => {
  /**
   * Every false positive here would have refused a real family. That is the
   * failure mode that matters: a typo can be corrected by anyone who notices,
   * but a family told their address is wrong when it is not simply leaves.
   */
  const valid = [
    "jimmy.arispe@theacademyway.org",
    "beckyaw53@gmail.com",
    "maria.c.jaramillo@hotmail.com",
    "ashleighmoreira@yahoo.ca",
    "nidajmj@gmail.com",
    "lesley@ariumrealestate.com",
    "heidi.bda@gmail.com",
    "hpadilla@winnco.com",
    "nicole@westcbss.com",
    "r.mourdia@gmail.com",
    // Unrecognised but perfectly real domains.
    "parent@some-small-school.org",
    "a@b.co",
    "family@mail.protonmail.ch",
    "person@university.edu",
    "someone@nhs.uk",
    "test@subdomain.company.com",
    // A different real provider that happens to sit one keystroke from a
    // common one. Listed explicitly so it is never "corrected".
    "someone@mail.com",
  ];

  for (const address of valid) {
    it(`leaves ${address} alone`, () => {
      expect(checkEmailAddress(address).kind).toBe("ok");
    });
  }

  it("does not turn me.com into a suggestion for every two-letter domain", () => {
    // A flat threshold of two edits would make me.com a "typo" of he.com,
    // we.com and be.com, which are different companies.
    for (const d of ["he.com", "we.com", "be.com", "de.com"]) {
      expect(checkEmailAddress(`a@${d}`).kind).toBe("ok");
    }
  });
});

describe("addresses that are genuinely malformed", () => {
  const bad = [
    "",
    "   ",
    "notanemail",
    "@gmail.com",
    "someone@",
    "two@at@gmail.com",
    "has space@gmail.com",
    "someone@gmail",
    "someone@.com",
    "someone@gmail..com",
    "someone@gmail.c",
    "someone@gmail.123",
  ];

  for (const address of bad) {
    it(`rejects ${JSON.stringify(address)}`, () => {
      expect(checkEmailAddress(address).kind).toBe("invalid");
    });
  }

  it("explains the problem in words a parent can act on", () => {
    const result = checkEmailAddress("has space@gmail.com");
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.reason).toMatch(/space/i);
    }
  });
});

describe("it never suggests something worse than what was typed", () => {
  it("a suggestion is always itself a valid address", () => {
    const inputs = [
      "a@gmial.com",
      "b@yahoo.con",
      "c.d@hotmial.com",
      "e@outlok.com",
      "f@example.cmo",
    ];
    for (const input of inputs) {
      const result = checkEmailAddress(input);
      if (result.kind === "suggest") {
        expect(checkEmailAddress(result.suggestion).kind).toBe("ok");
      }
    }
  });
});
