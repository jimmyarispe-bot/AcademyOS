import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  STUDENT_QUESTIONS,
  STUDENT_QUESTION_KEYS,
  isStudentQuestionKey,
  studentQuestionLabel,
} from "@/lib/admissions/student-questionnaire/questions";
import {
  hashStudentTokenHex,
  mintStudentToken,
  renderStudentQuestionnaireEmail,
  studentQuestionnaireLink,
} from "@/lib/admissions/student-questionnaire/send";

describe("the questions themselves", () => {
  it("asks all five", () => {
    expect(STUDENT_QUESTIONS).toHaveLength(5);
    expect(STUDENT_QUESTIONS.map((q) => q.key)).toEqual([...STUDENT_QUESTION_KEYS]);
  });

  it("keeps the keys that version 13 used, so an answer means the same thing", () => {
    expect([...STUDENT_QUESTION_KEYS]).toEqual([
      "hs_student_why_join",
      "hs_student_biggest_challenge",
      "hs_student_principal_change",
      "hs_student_greatness",
      "hs_student_treated_better",
    ]);
  });

  it("refuses a key it does not know", () => {
    expect(isStudentQuestionKey("hs_student_why_join")).toBe(true);
    expect(isStudentQuestionKey("guardian_email")).toBe(false);
    expect(isStudentQuestionKey("__proto__")).toBe(false);
  });

  it("falls back to the key rather than rendering undefined", () => {
    expect(studentQuestionLabel("nonsense")).toBe("nonsense");
  });
});

/**
 * The database is the thing that decides what it will store, and it carries its
 * own copy of these five keys. Two lists that must agree and live in different
 * languages drift the moment somebody edits one — so this reads the migration
 * and checks.
 */
describe("the database's copy of the keys", () => {
  it("matches the application's", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/340_hs_student_questionnaire_2026_09_12.sql"),
      "utf8"
    );
    const marker = "v_allowed text[] := array[";
    const from = sql.indexOf(marker);
    expect(from).toBeGreaterThan(-1);
    const block = sql.slice(from + marker.length);
    const keysInSql = [...block.slice(0, block.indexOf("]")).matchAll(/'([a-z_]+)'/g)].map(
      (m) => m[1]
    );
    expect(keysInSql).toEqual([...STUDENT_QUESTION_KEYS]);
  });
});

describe("tokens", () => {
  it("mints something long enough to be worth hashing", () => {
    const token = mintStudentToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).not.toMatch(/[^A-Za-z0-9_-]/);
  });

  it("mints a different one every time", () => {
    const seen = new Set(Array.from({ length: 50 }, () => mintStudentToken()));
    expect(seen.size).toBe(50);
  });

  it("hashes to the bytea literal Postgres wants", () => {
    const hash = hashStudentTokenHex("a".repeat(32));
    expect(hash).toMatch(/^\\x[0-9a-f]{64}$/);
  });

  it("hashes the same token to the same digest", () => {
    const token = mintStudentToken();
    expect(hashStudentTokenHex(token)).toBe(hashStudentTokenHex(token));
  });

  it("refuses a token too short to be one of ours", () => {
    expect(() => hashStudentTokenHex("abc")).toThrow();
  });
});

describe("the email", () => {
  const message = renderStudentQuestionnaireEmail({
    schoolName: "The Academy HS",
    studentFirstName: "Maya",
    link: "https://apply.theacademyway.org/student-questions/abc123",
  });

  it("is addressed to the student, not the parent", () => {
    expect(message.html).toContain("Hi Maya,");
    expect(message.text).toContain("Hi Maya,");
  });

  it("lists every question in the body, so it can be read before clicking", () => {
    for (const question of STUDENT_QUESTIONS) {
      expect(message.text).toContain(question.label);
    }
  });

  it("carries the link in both the button and as plain text", () => {
    expect(message.html).toContain("https://apply.theacademyway.org/student-questions/abc123");
    expect(message.text).toContain("https://apply.theacademyway.org/student-questions/abc123");
  });

  it("escapes a name that contains markup", () => {
    const nasty = renderStudentQuestionnaireEmail({
      schoolName: "The Academy HS",
      studentFirstName: '<script>alert(1)</script>',
      link: "https://example.org/x",
    });
    expect(nasty.html).not.toContain("<script>");
    expect(nasty.html).toContain("&lt;script&gt;");
  });

  it("greets a student whose first name is missing without an empty gap", () => {
    const anon = renderStudentQuestionnaireEmail({
      schoolName: "The Academy HS",
      studentFirstName: "",
      link: "https://example.org/x",
    });
    expect(anon.html).toContain("Hi,");
    expect(anon.html).not.toContain("Hi ,");
  });
});

describe("the link", () => {
  it("points at the questionnaire route", () => {
    expect(studentQuestionnaireLink("abc123")).toMatch(/\/student-questions\/abc123$/);
  });

  it("escapes a token that would otherwise change the path", () => {
    expect(studentQuestionnaireLink("a/b")).toContain("a%2Fb");
  });
});
