"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createLead } from "@/lib/admissions/actions";
import { GRADES } from "@/lib/constants/grades";
import { PROGRAMS } from "@/lib/constants/programs";
import { FundingSourceCheckboxes } from "@/components/ui/FundingSourceCheckboxes";

interface LeadFormProps {
  schools: { id: string; name: string }[];
}

export function LeadForm({ schools }: LeadFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createLead(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/admissions/leads/${result.id}`);
    });
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
  const labelClass = "block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="first_name">First Name *</label>
          <input id="first_name" name="first_name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="last_name">Last Name *</label>
          <input id="last_name" name="last_name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="preferred_name">Preferred Name</label>
          <input id="preferred_name" name="preferred_name" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="date_of_birth">Date of Birth</label>
          <input id="date_of_birth" name="date_of_birth" type="date" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="current_grade">Current Grade</label>
          <select id="current_grade" name="current_grade" className={inputClass} defaultValue="">
            <option value="">Select grade</option>
            {GRADES.map((grade) => (
              <option key={grade.value} value={grade.value}>{grade.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="applying_for_grade">Applying For Grade</label>
          <select id="applying_for_grade" name="applying_for_grade" className={inputClass} defaultValue="">
            <option value="">Select grade</option>
            {GRADES.map((grade) => (
              <option key={grade.value} value={grade.value}>{grade.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="school_id">School *</label>
          <select id="school_id" name="school_id" required className={inputClass} defaultValue="">
            <option value="" disabled>Select school</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="program">Program</label>
          <select id="program" name="program" className={inputClass} defaultValue="">
            <option value="">Select program</option>
            {PROGRAMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <FundingSourceCheckboxes />
        </div>
        <div>
          <label className={labelClass} htmlFor="referral_source">Referral Source</label>
          <input id="referral_source" name="referral_source" className={inputClass} />
        </div>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900">Guardian Information</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="guardian_first_name">First Name</label>
            <input id="guardian_first_name" name="guardian_first_name" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="guardian_last_name">Last Name</label>
            <input id="guardian_last_name" name="guardian_last_name" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="guardian_email">Email</label>
            <input id="guardian_email" name="guardian_email" type="email" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="guardian_phone">Phone</label>
            <input id="guardian_phone" name="guardian_phone" type="tel" className={inputClass} />
          </div>
        </div>
      </fieldset>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create Lead"}
        </button>
      </div>
    </form>
  );
}
