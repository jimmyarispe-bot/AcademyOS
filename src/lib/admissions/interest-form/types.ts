/**
 * Admissions Interest Form — Phase 1 types (versioned definition + answers).
 */

import type { FormConditionGroup } from "@/lib/platform/forms/types";

export const INTEREST_FORM_SCHEMA_VERSION = "interest_form.v1" as const;

export type InterestFieldType =
  | "text"
  | "rich_text"
  | "email"
  | "phone"
  | "date"
  | "number"
  /** A number shown and validated as money. Stored as a plain number. */
  | "currency"
  | "select"
  | "multiselect"
  | "boolean"
  | "school_selector"
  | "program_selector"
  | "consent"
  /**
   * A typed-name signature against a statement.
   *
   * The statement is the question's label; the answer is the name the person
   * types. The date is not a separate field — the submission already carries
   * `submitted_at`, and a second date a parent can edit is a date that can
   * disagree with the record.
   */
  | "signature"
  /**
   * A document. The stored answer is the storage path returned by
   * /api/apply/upload, never the file itself and never a name the browser chose.
   */
  | "file";

export type InterestOptionSource = "grades" | "funding_sources" | "programs" | "schools";

export type InterestQuestionOption = {
  readonly value: string;
  readonly label: string;
};

export type InterestQuestionDefinition = {
  readonly key: string;
  readonly type: InterestFieldType;
  readonly label: string;
  readonly required: boolean;
  readonly order: number;
  readonly systemBinding?: string | null;
  readonly options?: readonly InterestQuestionOption[];
  readonly optionSource?: InterestOptionSource;
  readonly placeholder?: string;
  readonly defaultValue?: unknown;
  readonly visibleWhen?: FormConditionGroup | null;
  readonly helpText?: string;
};

export type InterestSectionDefinition = {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  readonly order: number;
  readonly questionKeys: readonly string[];
  readonly visibleWhen?: FormConditionGroup | null;
};

export type InterestFormDefinition = {
  readonly schemaVersion: typeof INTEREST_FORM_SCHEMA_VERSION | string;
  readonly title: string;
  readonly sections: readonly InterestSectionDefinition[];
  readonly questions: readonly InterestQuestionDefinition[];
};

export type InterestFormValues = Record<string, unknown>;

export type PublishedInterestForm = {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly formId: string;
  readonly formVersionId: string;
  readonly versionNumber: number;
  readonly definition: InterestFormDefinition;
  readonly schools: readonly { id: string; name: string }[];
};

export type InterestProgramOption = {
  readonly code: string;
  readonly name: string;
};
