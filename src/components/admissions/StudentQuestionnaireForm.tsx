"use client";

import { useState } from "react";
import { submitStudentQuestionnaire } from "@/lib/admissions/student-questionnaire/actions";
import {
  STUDENT_QUESTIONS,
  type StudentQuestionKey,
} from "@/lib/admissions/student-questionnaire/questions";

/**
 * The form the student fills in.
 *
 * Five boxes, generous ones. The questions ask for a paragraph and a
 * single-line input would tell the student to write a sentence instead.
 *
 * Partial answers go through. A student who has answered four and is stuck on
 * the fifth should be able to send four rather than close the tab — and the
 * alternative, a browser refusing to submit until every box is full, is how a
 * sixteen-year-old decides not to bother.
 */
export function StudentQuestionnaireForm({ token }: { token: string }) {
  const [values, setValues] = useState<Partial<Record<StudentQuestionKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const answered = STUDENT_QUESTIONS.filter((q) => (values[q.key] ?? "").trim()).length;

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await submitStudentQuestionnaire({ token, answers: values });
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.error);
  }

  if (done) {
    return (
      <div className="mt-8 rounded-2xl bg-emerald-50 p-6">
        <h2 className="text-lg font-semibold text-emerald-900">Thank you</h2>
        <p className="mt-2 text-emerald-800">
          Your answers are with the admissions team. There is nothing else for you to do —
          they will be in touch with your family.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-8 space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {STUDENT_QUESTIONS.map((question, index) => (
        <div key={question.key}>
          <label
            htmlFor={question.key}
            className="block text-sm font-medium text-slate-900"
          >
            {index + 1}. {question.label}
          </label>
          <textarea
            id={question.key}
            name={question.key}
            rows={5}
            value={values[question.key] ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, [question.key]: e.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      ))}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy || answered === 0}
          className="rounded-xl bg-[#1e3a8a] px-8 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Sending…" : "Send my answers"}
        </button>
        <span className="text-sm text-slate-500">
          {answered} of {STUDENT_QUESTIONS.length} answered
        </span>
      </div>

      <p className="text-sm text-slate-500">
        You can only send once, so finish what you want to say before you press the button.
      </p>
    </form>
  );
}
