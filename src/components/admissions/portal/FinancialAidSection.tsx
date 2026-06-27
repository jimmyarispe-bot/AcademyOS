"use client";

import { useState, useTransition } from "react";
import { saveFinancialAidApplication } from "@/lib/admissions/portal/actions";
import type { PortalScholarshipApplication } from "@/lib/admissions/portal/queries";
import { portalInputClass, portalLabelClass, portalSectionClass } from "./styles";

interface FinancialAidSectionProps {
  applicationId: string;
  scholarship: PortalScholarshipApplication | null;
}

export function FinancialAidSection({ applicationId, scholarship }: FinancialAidSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    formData.set("application_id", applicationId);
    if (scholarship?.id) {
      formData.set("scholarship_application_id", scholarship.id);
    }

    startTransition(async () => {
      const result = await saveFinancialAidApplication(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className={`${portalSectionClass} space-y-4`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Financial Aid Application</h2>
        <p className="text-sm text-slate-500">
          Provide household financial information for scholarship review.
        </p>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Financial aid information saved.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={portalLabelClass} htmlFor="household_income">
            Annual Household Income *
          </label>
          <input
            id="household_income"
            name="household_income"
            type="number"
            min="0"
            step="1000"
            required
            defaultValue={scholarship?.household_income ?? ""}
            className={portalInputClass}
          />
        </div>
        <div>
          <label className={portalLabelClass} htmlFor="requested_amount">
            Requested Scholarship Amount *
          </label>
          <input
            id="requested_amount"
            name="requested_amount"
            type="number"
            min="0"
            step="100"
            required
            defaultValue={scholarship?.requested_amount ?? ""}
            className={portalInputClass}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Financial Aid Info"}
        </button>
      </div>
    </form>
  );
}
