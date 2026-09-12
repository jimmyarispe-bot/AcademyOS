import { describe, expect, it } from "vitest";
import { isLinkableEmail, mailtoHref, telHref } from "@/lib/format/contact";

/**
 * What is stored is whatever somebody typed. These decide what a phone can
 * dial from it, without changing what the reader sees.
 */
describe("telHref", () => {
  it("assumes North America for a bare ten digits", () => {
    expect(telHref("4075550123")).toBe("tel:+14075550123");
    expect(telHref("(407) 555-0123")).toBe("tel:+14075550123");
    expect(telHref("407.555.0123")).toBe("tel:+14075550123");
    expect(telHref("407 555 0123")).toBe("tel:+14075550123");
  });

  it("treats eleven digits starting with 1 the same way", () => {
    expect(telHref("1-407-555-0123")).toBe("tel:+14075550123");
  });

  it("keeps an international number as given", () => {
    expect(telHref("+44 20 7946 0958")).toBe("tel:+442079460958");
    expect(telHref("+1 (407) 555-0123")).toBe("tel:+14075550123");
  });

  /**
   * Some diallers honour `;ext=` and some silently fail on it. A number that
   * reaches the switchboard beats one that reaches nothing.
   */
  it("drops an extension rather than gambling on it", () => {
    expect(telHref("407-555-0123 ext 12")).toBe("tel:407555012312");
  });

  it("refuses something too short to be a number", () => {
    expect(telHref("123")).toBeNull();
    expect(telHref("n/a")).toBeNull();
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref(undefined)).toBeNull();
  });
});

describe("email linking", () => {
  it("links an ordinary address", () => {
    expect(mailtoHref("jimmy.arispe@gmail.com")).toBe("mailto:jimmy.arispe@gmail.com");
    expect(mailtoHref("  danni@theacademyway.org  ")).toBe("mailto:danni@theacademyway.org");
  });

  /**
   * Loose on purpose. This decides whether to render a link, not whether to
   * accept an address — refusing to link a real one costs somebody a click
   * every day, which is the worse mistake here.
   */
  it("links an unusual but plausible address", () => {
    expect(isLinkableEmail("first+tag@sub.domain.co.uk")).toBe(true);
    expect(isLinkableEmail("o'brien@school.org")).toBe(true);
  });

  it("refuses what is plainly not an address", () => {
    expect(isLinkableEmail("no email on file")).toBe(false);
    expect(isLinkableEmail("ask mum")).toBe(false);
    expect(isLinkableEmail("jimmy@localhost")).toBe(false);
    expect(isLinkableEmail("@gmail.com")).toBe(false);
    expect(isLinkableEmail("jimmy@")).toBe(false);
    expect(isLinkableEmail("")).toBe(false);
    expect(isLinkableEmail(null)).toBe(false);
  });

  it("returns null rather than a broken mailto", () => {
    expect(mailtoHref("no email on file")).toBeNull();
  });
});

/**
 * The staff alert's dial link uses this, via the `parent_phone_dial` merge
 * field. A template cannot normalise anything, so whatever this returns is
 * exactly what ends up inside `tel:` in somebody's inbox.
 */
describe("the dialable form used by email templates", () => {
  it("strips the scheme so a template can write tel: itself", () => {
    const dial = (telHref("(407) 555-0123") ?? "").replace(/^tel:/, "");
    expect(dial).toBe("+14075550123");
  });

  it("gives an empty string rather than a broken link when there is no number", () => {
    const dial = (telHref(null) ?? "").replace(/^tel:/, "");
    expect(dial).toBe("");
  });
});
