/**
 * Interest Form definition helpers — visibility, validation, option resolution.
 */

import { createHash } from "node:crypto";
import { evaluateFormConditions } from "@/lib/platform/forms/visibility";
import { GRADES } from "@/lib/constants/grades";
import { FUNDING_SOURCES, PROGRAMS } from "@/lib/constants/programs";
import {
  isInterestFormProgramValue,
  normalizeInterestProgramSelections,
} from "@/lib/admissions/interest-form/program-options";
import type {
  InterestFormDefinition,
  InterestFormValues,
  InterestQuestionDefinition,
  InterestQuestionOption,
  InterestSectionDefinition,
} from "@/lib/admissions/interest-form/types";
import { INTEREST_FORM_SCHEMA_VERSION } from "@/lib/admissions/interest-form/types";
import { checkEmailAddress } from "@/lib/admissions/email-check";

export function hashInterestFormDefinition(definition: InterestFormDefinition): string {
  return createHash("sha256")
    .update(JSON.stringify(definition))
    .digest("hex");
}

export function parseInterestFormDefinition(
  raw: unknown
): InterestFormDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const def = raw as InterestFormDefinition;
  if (!def.schemaVersion || !Array.isArray(def.sections) || !Array.isArray(def.questions)) {
    return null;
  }
  if (!def.schemaVersion.startsWith("interest_form.")) return null;
  return def;
}

export function questionByKey(
  definition: InterestFormDefinition,
  key: string
): InterestQuestionDefinition | undefined {
  return definition.questions.find((q) => q.key === key);
}

export function isSectionVisible(
  section: InterestSectionDefinition,
  values: InterestFormValues
): boolean {
  return evaluateFormConditions(section.visibleWhen ?? undefined, values);
}

export function isQuestionVisible(
  question: InterestQuestionDefinition,
  values: InterestFormValues,
  sectionVisible: boolean
): boolean {
  if (!sectionVisible) return false;
  return evaluateFormConditions(question.visibleWhen ?? undefined, values);
}

export function resolveStaticOptions(
  question: InterestQuestionDefinition
): readonly InterestQuestionOption[] {
  if (question.options?.length) return question.options;
  switch (question.optionSource) {
    case "grades":
      return GRADES.map((g) => ({ value: g.value, label: g.label }));
    case "funding_sources":
      return FUNDING_SOURCES.map((f) => ({ value: f.value, label: f.label }));
    case "programs":
      return PROGRAMS.map((p) => ({ value: p.value, label: p.label }));
    default:
      return [];
  }
}

export function validateInterestFormDefinition(
  definition: InterestFormDefinition
): string[] {
  const errors: string[] = [];
  if (definition.schemaVersion !== INTEREST_FORM_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: ${definition.schemaVersion}`);
  }
  const keys = new Set<string>();
  for (const q of definition.questions) {
    if (!q.key?.trim()) errors.push("Question missing key");
    if (keys.has(q.key)) errors.push(`Duplicate question key: ${q.key}`);
    keys.add(q.key);
  }
  for (const section of definition.sections) {
    for (const key of section.questionKeys) {
      if (!keys.has(key)) errors.push(`Section ${section.key} references missing key ${key}`);
    }
  }
  const hasSchool = definition.questions.some((q) => q.type === "school_selector");
  if (!hasSchool) errors.push("Definition must include a school_selector question");
  return errors;
}

export type InterestValidationIssue = {
  readonly path: string;
  readonly message: string;
};

/**
 * Non-question FormData / value keys accepted alongside published questions.
 * Anything else unknown is rejected (integrity boundary).
 *
 * - company_website / cf-turnstile-response — anti-spam
 * - form_version_id — stale-version check (not an answer)
 * - source — submission metadata (`admissions_interest_submissions.source`)
 */
export const INTEREST_FORM_METADATA_KEYS = [
  "company_website",
  "form_version_id",
  "cf-turnstile-response",
  "source",
] as const;

export type InterestFormMetadataKey = (typeof INTEREST_FORM_METADATA_KEYS)[number];

export function isInterestFormMetadataKey(key: string): key is InterestFormMetadataKey {
  return (INTEREST_FORM_METADATA_KEYS as readonly string[]).includes(key);
}

/** Canonical submission.source for the public Express Interest path. */
export const EXPRESS_INTEREST_SUBMISSION_SOURCE = "express_interest" as const;

/**
 * Validate submission values against a published definition and current options.
 */
export function validateInterestSubmission(input: {
  definition: InterestFormDefinition;
  values: InterestFormValues;
  schoolIds: ReadonlySet<string>;
  programCodesForSchool: ReadonlySet<string>;
  claimedFormVersionId: string | null | undefined;
  publishedFormVersionId: string;
}): { ok: true; visibleValues: InterestFormValues } | { ok: false; issues: InterestValidationIssue[] } {
  const issues: InterestValidationIssue[] = [];

  if (
    input.claimedFormVersionId &&
    input.claimedFormVersionId !== input.publishedFormVersionId
  ) {
    issues.push({
      path: "form_version_id",
      message: "This form has been updated. Please refresh and submit again.",
    });
  }

  const visibleValues: InterestFormValues = {};
  const knownKeys = new Set(input.definition.questions.map((q) => q.key));

  for (const key of Object.keys(input.values)) {
    if (isInterestFormMetadataKey(key)) {
      continue;
    }
    if (!knownKeys.has(key)) {
      issues.push({ path: key, message: `Unknown question: ${key}` });
    }
  }

  const sectionVisibility = new Map<string, boolean>();
  for (const section of [...input.definition.sections].sort((a, b) => a.order - b.order)) {
    sectionVisibility.set(section.key, isSectionVisible(section, input.values));
  }

  for (const question of input.definition.questions) {
    const section = input.definition.sections.find((s) =>
      s.questionKeys.includes(question.key)
    );
    const sectionVisible = section
      ? (sectionVisibility.get(section.key) ?? true)
      : true;
    const visible = isQuestionVisible(question, input.values, sectionVisible);
    const raw = input.values[question.key];

    if (!visible) continue;

    const empty =
      raw === undefined ||
      raw === null ||
      raw === "" ||
      (Array.isArray(raw) && raw.length === 0);

    if (question.required && empty) {
      issues.push({ path: question.key, message: `${question.label} is required.` });
      continue;
    }
    if (empty) {
      visibleValues[question.key] = raw ?? null;
      continue;
    }

    switch (question.type) {
      case "email": {
        // Trimmed before storing. A trailing space is invisible in every UI
        // that shows the value back, and it is enough to make a real address
        // fail every later check and some mail APIs outright.
        const v = String(raw).trim();
        const check = checkEmailAddress(v);
        if (check.kind === "invalid") {
          // The specific reason, not "Enter a valid email." A parent who is
          // told what is wrong fixes it; a parent told only that it is wrong
          // retypes the same thing.
          issues.push({ path: question.key, message: check.reason });
        } else {
          // A "suggest" result is deliberately NOT an issue. The domain looks
          // like a typo, and it may well be one, but it may also be the
          // family's real address — and blocking a real family is the more
          // expensive mistake. The form offers the correction; it does not
          // insist on it.
          visibleValues[question.key] = v;
        }
        break;
      }
      case "school_selector": {
        const id = String(raw).trim();
        if (!input.schoolIds.has(id)) {
          issues.push({ path: question.key, message: "Select a valid school." });
        } else {
          visibleValues[question.key] = id;
        }
        break;
      }
      case "program_selector": {
        const selected = normalizeInterestProgramSelections(raw);
        if (selected.some((value) => !isInterestFormProgramValue(value))) {
          issues.push({
            path: question.key,
            message: "Select a valid program type.",
          });
        } else {
          visibleValues[question.key] = selected;
        }
        break;
      }
      case "select": {
        const v = String(raw).trim();
        const options = resolveStaticOptions(question);
        if (options.length && !options.some((o) => o.value === v)) {
          issues.push({ path: question.key, message: "Invalid option selected." });
        } else {
          visibleValues[question.key] = v;
        }
        break;
      }
      case "multiselect": {
        const arr = Array.isArray(raw)
          ? raw.map(String)
          : String(raw)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        const options = resolveStaticOptions(question);
        if (options.length && arr.some((v) => !options.some((o) => o.value === v))) {
          issues.push({ path: question.key, message: "Invalid option selected." });
        } else {
          visibleValues[question.key] = arr;
        }
        break;
      }
      case "boolean":
      case "consent":
        visibleValues[question.key] = Boolean(raw);
        break;
      case "number": {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(n)) {
          issues.push({ path: question.key, message: "Enter a valid number." });
        } else {
          visibleValues[question.key] = n;
        }
        break;
      }
      default:
        visibleValues[question.key] = typeof raw === "string" ? raw.trim() : raw;
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, visibleValues };
}

export function formDataToInterestValues(formData: FormData): InterestFormValues {
  const values: InterestFormValues = {};
  const funding: string[] = [];
  const programs: string[] = [];
  for (const [key, value] of formData.entries()) {
    // Metadata stays out of answer/value maps (submission.source is read separately).
    if (isInterestFormMetadataKey(key)) {
      continue;
    }
    if (key === "funding_sources") {
      funding.push(String(value));
      continue;
    }
    if (key === "program") {
      programs.push(String(value));
      continue;
    }
    if (values[key] !== undefined) {
      const prev = values[key];
      values[key] = Array.isArray(prev)
        ? [...prev, String(value)]
        : [String(prev), String(value)];
    } else {
      values[key] = String(value);
    }
  }
  if (funding.length) values.funding_sources = funding;
  if (programs.length) values.program = normalizeInterestProgramSelections(programs);
  return values;
}
