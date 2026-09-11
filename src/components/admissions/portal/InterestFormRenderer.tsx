"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitInterestFormAction } from "@/lib/admissions/interest-form/actions";
import {
  isQuestionVisible,
  isSectionVisible,
  resolveStaticOptions,
} from "@/lib/admissions/interest-form/definition";
import {
  INTEREST_FORM_PROGRAM_OPTIONS,
  INTEREST_FORM_PROGRAM_QUESTION_HELP,
  INTEREST_FORM_PROGRAM_QUESTION_LABEL,
  normalizeInterestProgramSelections,
} from "@/lib/admissions/interest-form/program-options";
import type {
  InterestFormValues,
  InterestQuestionDefinition,
  PublishedInterestForm,
} from "@/lib/admissions/interest-form/types";
import { FundingSourceCheckboxes } from "@/components/ui/FundingSourceCheckboxes";
import { ActionButton, useActionFeedback } from "@/components/experience-system/feedback";
import { checkEmailAddress } from "@/lib/admissions/email-check";
import { ageLabelFromDateOfBirth } from "@/lib/format/age";
import {
  portalInputClass,
  portalLabelClass,
  portalSectionClass,
} from "@/components/admissions/portal/styles";

type InterestFormRendererProps = {
  published: PublishedInterestForm;
};

function defaultValues(published: PublishedInterestForm): InterestFormValues {
  const values: InterestFormValues = {};
  for (const q of published.definition.questions) {
    if (q.defaultValue !== undefined) values[q.key] = q.defaultValue;
  }
  return values;
}

function QuestionField({
  question,
  value,
  onChange,
  schools,
}: {
  question: InterestQuestionDefinition;
  value: unknown;
  onChange: (key: string, next: unknown) => void;
  schools: readonly { id: string; name: string }[];
}) {
  const id = question.key;
  const label = (
    <label className={portalLabelClass} htmlFor={id}>
      {question.label}
      {question.required ? " *" : ""}
    </label>
  );

  if (question.type === "school_selector") {
    return (
      <div>
        {label}
        <select
          id={id}
          name={id}
          required={question.required}
          className={portalInputClass}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(question.key, e.target.value)}
        >
          <option value="" disabled>
            Select school
          </option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (question.type === "program_selector") {
    const selected = new Set(normalizeInterestProgramSelections(value));
    return (
      <div className="sm:col-span-2">
        <fieldset>
          <legend className={portalLabelClass}>
            {INTEREST_FORM_PROGRAM_QUESTION_LABEL}
            {question.required ? " *" : ""}
          </legend>
          <p className="mt-1 text-sm text-slate-500">
            {question.helpText ?? INTEREST_FORM_PROGRAM_QUESTION_HELP}
          </p>
          <div className="mt-3 grid gap-2">
            {INTEREST_FORM_PROGRAM_OPTIONS.map((option) => {
              const checked = selected.has(option.value);
              const optionId = `${id}-${option.value}`;
              return (
                <label
                  key={option.value}
                  htmlFor={optionId}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    checked
                      ? "border-brand-500 bg-brand-50 text-slate-900"
                      : "border-slate-100 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    id={optionId}
                    name={id}
                    type="checkbox"
                    value={option.value}
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(option.value);
                      else next.delete(option.value);
                      onChange(question.key, [...next]);
                    }}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    );
  }

  if (question.type === "multiselect" && question.optionSource === "funding_sources") {
    return (
      <div className="sm:col-span-2">
        <FundingSourceCheckboxes />
      </div>
    );
  }

  /**
   * Every other multiselect — a checkbox group from the question's own options.
   *
   * Until v3 the only multiselect on any published form was funding sources,
   * which has its own component above. A multiselect defined with plain
   * `options` fell through every branch here and landed on the generic text
   * input at the bottom of this function: a single-line box, for a question
   * whose answer is a list. It would have looked like it worked.
   *
   * `required` is enforced by the submit validator rather than by the inputs.
   * Putting `required` on each checkbox would demand all ten be ticked; putting
   * it on none leaves the browser silent. The server already rejects an empty
   * required answer, so the honest thing is to let it.
   */
  if (question.type === "multiselect") {
    const options = resolveStaticOptions(question);
    const selected = new Set(
      Array.isArray(value) ? (value as unknown[]).map((entry) => String(entry)) : []
    );

    return (
      <div className="sm:col-span-2">
        <fieldset>
          <legend className={portalLabelClass}>
            {question.label}
            {question.required ? " *" : ""}
          </legend>
          {question.helpText ? (
            <p className="mt-1 text-sm text-slate-500">{question.helpText}</p>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {options.map((option) => {
              const optionId = `${id}-${option.value}`;
              const checked = selected.has(option.value);
              return (
                <label
                  key={option.value}
                  htmlFor={optionId}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    id={optionId}
                    // The form submits `new FormData(form)`, so an input
                    // without a name is invisible to it. Repeated keys are
                    // collected into an array by formDataToInterestValues.
                    name={question.key}
                    value={option.value}
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(option.value);
                      else next.delete(option.value);
                      onChange(question.key, [...next]);
                    }}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    );
  }

  if (question.type === "rich_text") {
    return (
      <div className="sm:col-span-2">
        {label}
        <textarea
          id={id}
          name={id}
          rows={3}
          className={portalInputClass}
          placeholder={question.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(question.key, e.target.value)}
          required={question.required}
        />
      </div>
    );
  }

  if (question.type === "select") {
    const options = resolveStaticOptions(question);
    return (
      <div>
        {label}
        <select
          id={id}
          name={id}
          className={portalInputClass}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(question.key, e.target.value)}
          required={question.required}
        >
          <option value="">Select…</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (question.type === "boolean" || question.type === "consent") {
    return (
      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(question.key, e.target.checked)}
          required={question.required}
        />
        <label className={portalLabelClass} htmlFor={id}>
          {question.label}
          {question.required ? " *" : ""}
        </label>
      </div>
    );
  }

  const inputType =
    question.type === "email"
      ? "email"
      : question.type === "phone"
        ? "tel"
        : question.type === "date"
          ? "date"
          : question.type === "number"
            ? "number"
            : "text";

  const text = typeof value === "string" || typeof value === "number" ? value : "";

  /**
   * A "did you mean" hint, for email fields only.
   *
   * Two addresses reached production through this form that its validation
   * could not catch, because both were perfectly well-formed and simply
   * addressed to the wrong place: `yahoo.con`, which bounced every message
   * since August, and `gmil.com`, which did not bounce at all.
   *
   * The hint SUGGESTS. It never blocks and never rewrites what was typed. A
   * parent on an unusual domain must be able to submit, and refusing a real
   * address is worse than accepting a typo — a typo can be corrected by anyone
   * who notices it, but a family told their email is invalid simply leaves.
   */
  const emailHint =
    question.type === "email" && typeof text === "string" && text.trim() !== ""
      ? checkEmailAddress(text)
      : null;

  /**
   * Age, shown back to the parent as they type the birthdate.
   *
   * It is not a field and it is not submitted. Asking for both a birthdate and
   * an age invites them to disagree, and the age is the one that goes stale.
   * Showing the derived value is also the cheapest possible check on a typo —
   * a parent who meant 2011 and typed 2001 sees "24 years old" under a
   * kindergarten application and fixes it themselves.
   */
  const ageHint =
    question.type === "date" && typeof text === "string" && text.trim() !== ""
      ? ageLabelFromDateOfBirth(text)
      : null;

  return (
    <div>
      {label}
      <input
        id={id}
        name={id}
        type={inputType}
        className={portalInputClass}
        placeholder={question.placeholder}
        value={text}
        onChange={(e) => onChange(question.key, e.target.value)}
        required={question.required}
        aria-describedby={
          emailHint && emailHint.kind !== "ok"
            ? `${id}-hint`
            : ageHint
              ? `${id}-age`
              : undefined
        }
      />
      {ageHint ? (
        <p id={`${id}-age`} className="mt-1 text-sm text-slate-600">
          {ageHint}
        </p>
      ) : null}
      {emailHint && emailHint.kind === "suggest" ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-amber-800">
          Did you mean{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => onChange(question.key, emailHint.suggestion)}
          >
            {emailHint.suggestion}
          </button>
          ? You can keep what you typed.
        </p>
      ) : null}
      {emailHint && emailHint.kind === "invalid" ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-amber-800">
          {emailHint.reason}
        </p>
      ) : null}
    </div>
  );
}

export function InterestFormRenderer({ published }: InterestFormRendererProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<InterestFormValues>(() => defaultValues(published));

  const action = useActionFeedback({
    verb: "submit",
    labels: { idle: "Submit Inquiry", loading: "Submitting…", success: "✓ Submitted" },
    successToast: "✓ Submitted",
    errorToast: "Unable to submit.",
    progressLabel: "Submitting inquiry…",
    onError: (err) => setError(err.message),
  });

  function setField(key: string, next: unknown) {
    setValues((prev) => ({ ...prev, [key]: next }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("form_version_id", published.formVersionId);
    formData.set("source", "express_interest");

    void action.run(async () => {
      const result = await submitInterestFormAction(formData);
      if ("error" in result && result.error) throw new Error(result.error);
      router.push(`/apply/thank-you?lead=${"leadId" in result ? result.leadId : ""}`);
      return result;
    });
  }

  const sections = [...published.definition.sections].sort((a, b) => a.order - b.order);

  return (
    <form onSubmit={handleSubmit} className={`${portalSectionClass} space-y-8`}>
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company_website">Company website</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <input type="hidden" name="form_version_id" value={published.formVersionId} />

      {sections.map((section) => {
        if (!isSectionVisible(section, values)) return null;
        const questions = section.questionKeys
          .map((key) => published.definition.questions.find((q) => q.key === key))
          .filter((q): q is InterestQuestionDefinition => Boolean(q))
          .filter((q) => isQuestionVisible(q, values, true));

        if (!questions.length) return null;

        return (
          <section key={section.key} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
              {section.description ? (
                <p className="text-sm text-slate-500">{section.description}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {questions.map((question) => (
                <QuestionField
                  key={question.key}
                  question={question}
                  value={values[question.key]}
                  onChange={setField}
                  schools={published.schools}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Large, centred, and in the network's blue.
          Not full width: ActionChip wraps every button in an inline-flex,
          items-start container, so w-full on the button resolves against a
          shrink-to-fit parent and does nothing. Not utility classes for the
          colour either - ActionChip joins its class strings without conflict
          resolution, so `bg-academy` against the variant's own background is
          settled by whichever rule the stylesheet emits last. That is how this
          page shipped with white text on a white button. `.btn-academy` is a
          real rule declared after the Tailwind import, which wins by order. */}
      <div className="flex justify-center pt-2">
        <ActionButton
          type="submit"
          size="lg"
          variant="primary"
          status={action.status}
          verb="submit"
          labels={{ idle: "Submit Inquiry", loading: "Submitting…", success: "✓ Submitted" }}
          errorMessage={action.errorMessage}
          className="btn-academy rounded-xl px-12 py-4 text-lg font-semibold"
        />
      </div>
    </form>
  );
}
