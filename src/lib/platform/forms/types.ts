/**
 * Universal Forms Framework (Sprint 073).
 * Applications register schemas; platform owns validation + render model runtime.
 * No application-specific field types (no StudentField / PatientField).
 */

export type FormFieldType =
  | "text"
  | "number"
  | "currency"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "multiselect"
  | "boolean"
  | "entity_reference"
  | "document_upload"
  | "rich_text";

export type FormConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "exists"
  | "in"
  /**
   * The value at `path` is a list and it contains `value`.
   *
   * The mirror of `in`, which asks whether a single value appears in a list
   * supplied by the condition. `contains` asks the same question of the answer
   * rather than of the rule, which is what a multiselect needs: "did they tick
   * GA GOAL?" is unanswerable with `eq` (the answer is an array, never equal to
   * a string) and with `in` (which would compare the whole array against a
   * list).
   */
  | "contains"
  | "empty";

export type FormCondition = {
  path: string;
  op: FormConditionOperator;
  value?: unknown;
};

export type FormConditionGroup = {
  all?: Array<FormCondition | FormConditionGroup>;
  any?: Array<FormCondition | FormConditionGroup>;
};

export type FormFieldOption = {
  value: string;
  label: string;
};

export type FormFieldValidation = {
  required?: boolean;
  regex?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** Hook id for application-provided uniqueness checks. */
  uniquenessHook?: string;
  /** Hook id for application-provided custom validators. */
  customValidator?: string;
  message?: string;
};

export type FormFieldDefinition = {
  key: string;
  type: FormFieldType;
  label: string;
  helpText?: string | null;
  placeholder?: string | null;
  options?: FormFieldOption[];
  /** For entity_reference fields. */
  entityType?: string | null;
  validation?: FormFieldValidation;
  /** When false/undefined rules fail, field is hidden. */
  visibleWhen?: FormConditionGroup;
  defaultValue?: unknown;
  metadata?: Record<string, unknown>;
};

export type FormSectionDefinition = {
  key: string;
  title: string;
  description?: string | null;
  fields: string[];
  visibleWhen?: FormConditionGroup;
  metadata?: Record<string, unknown>;
};

export type FormWorkflowBinding = {
  /** On successful submit: start this workflow definition. */
  startOnSubmit?: string | null;
  /** On submit: advance this transition on an existing instance id from values/context. */
  advanceOnSubmit?: {
    instanceIdPath: string;
    transitionKey: string;
  } | null;
  /** Mark workflow complete via transition to a terminal state (same as advance). */
  completeOnSubmit?: {
    instanceIdPath: string;
    transitionKey: string;
  } | null;
  createDecision?: boolean;
  attachDocuments?: boolean;
  recordTimeline?: boolean;
  participantBindings?: Array<{
    role: string;
    userIdPath?: string;
    domainRole?: string;
  }>;
};

export type FormPermissionRule = {
  action: "view" | "submit" | "edit";
  permission: string;
};

export type FormDefinition = {
  id: string;
  applicationId: string | null;
  entityType: string | null;
  version: string;
  title: string;
  description?: string | null;
  sections: FormSectionDefinition[];
  fields: FormFieldDefinition[];
  validation?: FormFieldValidation;
  workflow?: FormWorkflowBinding | null;
  permissions: FormPermissionRule[];
  metadata: Record<string, unknown>;
};

export type FormValues = Record<string, unknown>;

export type FormValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type FormValidationResult = {
  valid: boolean;
  issues: FormValidationIssue[];
};

export type RenderedField = FormFieldDefinition & {
  visible: boolean;
  value: unknown;
  disabled?: boolean;
};

export type RenderedSection = {
  key: string;
  title: string;
  description: string | null;
  visible: boolean;
  fields: RenderedField[];
};

/** Declarative render model — not a React component tree. */
export type FormRenderModel = {
  formId: string;
  version: string;
  title: string;
  description: string | null;
  entityType: string | null;
  sections: RenderedSection[];
  /** Flat map of visible field keys → values (defaults applied). */
  values: FormValues;
};

export type CustomValidatorFn = (
  value: unknown,
  values: FormValues,
  field: FormFieldDefinition
) => FormValidationIssue | null;

export type UniquenessHookFn = (
  value: unknown,
  values: FormValues,
  field: FormFieldDefinition
) => boolean | Promise<boolean>;

export type FormSubmitContext = {
  actorUserId?: string | null;
  organizationId?: string | null;
  entityId?: string | null;
  grantedPermissions?: ReadonlySet<string> | readonly string[];
  workflowGrantedPermissions?: ReadonlySet<string> | readonly string[];
  actorParticipantRole?: string | null;
  now?: string;
};

export type FormSubmitResult = {
  formId: string;
  values: FormValues;
  validation: FormValidationResult;
  entityId: string | null;
  workflowInstanceId: string | null;
  decisionIds: string[];
  documentIds: string[];
  timelineEventIds: string[];
  errors: string[];
};
