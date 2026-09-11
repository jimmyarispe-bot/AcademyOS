import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_EMAIL_FROM,
  DEFAULT_EMAIL_FROM_NAME,
  resolveEmailFrom,
  resolveEmailFromName,
} from "@/lib/platform/email/from";

afterEach(() => {
  delete process.env.EMAIL_FROM;
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.RESEND_FROM_NAME;
});

describe("resolveEmailFrom", () => {
  it("defaults to noreply@thejag.org", () => {
    // The last-resort sender is the platform's own domain, not a tenant's —
    // changed in 7a4e8ea6. Pinned to the literal so a silent change to the
    // constant cannot pass unnoticed.
    expect(resolveEmailFrom()).toBe(DEFAULT_EMAIL_FROM);
    expect(DEFAULT_EMAIL_FROM).toBe("noreply@thejag.org");
  });

  it("prefers EMAIL_FROM over RESEND_FROM_EMAIL", () => {
    process.env.RESEND_FROM_EMAIL = "legacy@example.com";
    process.env.EMAIL_FROM = "noreply@theacademyway.org";
    expect(resolveEmailFrom()).toBe("noreply@theacademyway.org");
  });

  it("falls back to RESEND_FROM_EMAIL when EMAIL_FROM is unset", () => {
    process.env.RESEND_FROM_EMAIL = "legacy@example.com";
    expect(resolveEmailFrom()).toBe("legacy@example.com");
  });

  it("prefers an explicit from address", () => {
    process.env.EMAIL_FROM = "noreply@theacademyway.org";
    expect(resolveEmailFrom("custom@theacademyway.org")).toBe(
      "custom@theacademyway.org"
    );
  });
});

describe("resolveEmailFromName", () => {
  it("defaults to The JAG", () => {
    expect(resolveEmailFromName()).toBe(DEFAULT_EMAIL_FROM_NAME);
    expect(DEFAULT_EMAIL_FROM_NAME).toBe("The JAG");
  });
});
