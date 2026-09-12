import { describe, expect, it } from "vitest";
import { validateInterestSubmission } from "@/lib/admissions/interest-form/definition";
import type { InterestFormDefinition } from "@/lib/admissions/interest-form/types";

const SCHOOL = "11111111-1111-4111-8111-111111111111";

const definition: InterestFormDefinition = {
  schemaVersion: "interest_form.v1",
  title: "Test",
  sections: [{ key: "s", title: "S", order: 0, questionKeys: ["school_id", "doc"] }],
  questions: [
    { key: "school_id", type: "school_selector", label: "School", required: true, order: 0 },
    { key: "doc", type: "file", label: "Document", required: false, order: 1 },
  ],
};

function submit(doc: unknown) {
  return validateInterestSubmission({
    definition,
    values: { school_id: SCHOOL, doc },
    schoolIds: new Set([SCHOOL]),
    programCodesForSchool: [],
    claimedFormVersionId: null,
    publishedFormVersionId: null,
  });
}

/**
 * The answer to a file question is a storage path, and the browser supplies it.
 * A client posting the form directly can put anything in that field, so the
 * server accepts only paths shaped like the ones its own upload route issues.
 * Without this, a person could name any object in the bucket and have somebody
 * else's document attached to their own inquiry.
 */
describe("file answers", () => {
  const good = "interest-uploads/0f8fad5b-d9cb-469f-a165-70867728950e.pdf";

  it("accepts a path the upload route would have issued", () => {
    const result = submit(good);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visibleValues.doc).toBe(good);
  });

  it("accepts each permitted file type", () => {
    for (const ext of ["pdf", "jpg", "png", "heic", "heif"]) {
      const result = submit(`interest-uploads/0f8fad5b-d9cb-469f-a165-70867728950e.${ext}`);
      expect(result.ok, ext).toBe(true);
    }
  });

  it("refuses a path outside the upload prefix", () => {
    expect(submit("other-folder/0f8fad5b-d9cb-469f-a165-70867728950e.pdf").ok).toBe(false);
  });

  it("refuses traversal", () => {
    expect(submit("interest-uploads/../secrets/payroll.pdf").ok).toBe(false);
  });

  it("refuses a name that is not a generated uuid", () => {
    expect(submit("interest-uploads/somebody-elses-file.pdf").ok).toBe(false);
  });

  it("refuses an extension the upload route never issues", () => {
    expect(submit("interest-uploads/0f8fad5b-d9cb-469f-a165-70867728950e.exe").ok).toBe(false);
  });

  it("leaves an optional upload empty rather than failing", () => {
    const result = submit("");
    expect(result.ok).toBe(true);
  });
});
