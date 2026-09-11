import { describe, expect, it } from "vitest";
import { ageFromDateOfBirth, ageLabelFromDateOfBirth } from "@/lib/format/age";

describe("ageFromDateOfBirth", () => {
  const asOf = new Date(2026, 8, 11); // 11 Sep 2026, local

  it("counts whole years", () => {
    expect(ageFromDateOfBirth("2011-04-27", asOf)).toBe(15);
  });

  it("does not credit a birthday that has not happened yet", () => {
    expect(ageFromDateOfBirth("2011-09-12", asOf)).toBe(14);
  });

  it("credits the birthday on the day itself", () => {
    expect(ageFromDateOfBirth("2011-09-11", asOf)).toBe(15);
  });

  it("reads a date-only string as local time, not UTC", () => {
    // Parsed as UTC midnight this is 31 Dec in the US and the age ticks early.
    expect(ageFromDateOfBirth("2012-01-01", new Date(2026, 0, 1))).toBe(14);
  });

  it("rejects a future birthdate", () => {
    expect(ageFromDateOfBirth("2030-01-01", asOf)).toBeNull();
  });

  it("rejects unparseable and empty input", () => {
    expect(ageFromDateOfBirth("not a date", asOf)).toBeNull();
    expect(ageFromDateOfBirth("", asOf)).toBeNull();
    expect(ageFromDateOfBirth(null, asOf)).toBeNull();
  });

  it("rejects an implausible age rather than showing it", () => {
    expect(ageFromDateOfBirth("1500-01-01", asOf)).toBeNull();
  });

  it("labels singular and plural", () => {
    expect(ageLabelFromDateOfBirth("2025-01-01", asOf)).toBe("1 year old");
    expect(ageLabelFromDateOfBirth("2011-04-27", asOf)).toBe("15 years old");
  });
});
