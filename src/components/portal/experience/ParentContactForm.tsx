"use client";

import { useState } from "react";
import { updateMyGuardianContactAction } from "@/lib/portal/actions";
import { ActionButton, useActionFeedback } from "@/components/experience-system/feedback";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

/**
 * The form a parent uses to correct their own details.
 *
 * Separate from ParentProfileForm, which handles communication preferences and
 * was never wrong — it saves preferences and says so. What was missing was
 * anywhere to change a name, an email or a phone number, which is what the
 * go-live email asks families to do.
 *
 * `needsConfirmation` is true for the rows built from billing data. Those have
 * a placeholder name ("Parent/Guardian Bowden") and a billing phone that may or
 * may not be the right person's, so the parent is told plainly rather than
 * shown a form that implies the school already knows who they are.
 */
export function ParentContactForm({
  defaults,
  needsConfirmation,
}: {
  defaults: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  needsConfirmation: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const action = useActionFeedback({
    verb: "save",
    successToast: "✓ Details saved",
    errorToast: "Unable to save your details.",
    onError: (err) => setError(err.message),
  });

  return (
    <form
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        const formData = new FormData(e.currentTarget);
        void action.run(async () => {
          const result = await updateMyGuardianContactAction(formData);
          if ("error" in result && result.error) throw new Error(result.error);
          setSaved(true);
          return result;
        });
      }}
    >
      <div>
        <h2 className="font-semibold text-slate-900">Your details</h2>
        <p className="text-sm text-slate-500">
          This is how the school reaches you. Please correct anything that is wrong.
        </p>
      </div>

      {needsConfirmation && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          We filled these in from our billing records, so the name may not be
          right. Please check them.
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {saved && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Thank you — your details are saved.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">First name *</span>
          <input
            name="first_name"
            required
            defaultValue={defaults.first_name}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Last name *</span>
          <input
            name="last_name"
            required
            defaultValue={defaults.last_name}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={defaults.email}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Mobile phone</span>
          <input
            name="phone"
            type="tel"
            defaultValue={defaults.phone}
            className={inputClass}
          />
        </label>
      </div>

      <ActionButton
        type="submit"
        status={action.status}
        verb="save"
        labels={{ idle: "Save my details", loading: "Saving…", success: "✓ Saved" }}
      />
    </form>
  );
}
