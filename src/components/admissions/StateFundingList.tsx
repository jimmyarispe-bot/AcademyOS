"use client";

import { useTransition } from "react";
import { saveStateFundingAward } from "@/lib/admissions/sprint15-actions";
import { VERIFICATION_STATUS_LABELS } from "@/lib/constants/admissions-portal";
import type { FundingProgram, StateFundingAward } from "@/lib/admissions/state-funding";

interface StateFundingListProps {
  awards: StateFundingAward[];
  programs: FundingProgram[];
}

export function StateFundingList({ awards, programs }: StateFundingListProps) {
  const [isPending, startTransition] = useTransition();

  if (awards.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No state funding records yet. Awards are created when applications include state funding sources.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {awards.map((award) => {
        const lead = award.admissions_applications?.admissions_leads;
        return (
          <article key={award.id} className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {lead ? `${lead.first_name} ${lead.last_name}` : "Unknown Student"}
                </h3>
                <p className="text-sm text-slate-500">
                  {lead?.schools?.name ?? "—"} · {award.funding_program_catalog?.program_name ?? award.funding_source_code}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize">
                {VERIFICATION_STATUS_LABELS[award.verification_status] ?? award.verification_status}
              </span>
            </div>

            <form
              className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("id", award.id);
                startTransition(async () => {
                  await saveStateFundingAward(fd);
                });
              }}
            >
              <Field label="Program" name="funding_program_id" defaultValue={award.funding_program_id ?? ""}>
                <select name="funding_program_id" defaultValue={award.funding_program_id ?? ""} className={inputClass}>
                  <option value="">Select program</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.program_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="State" name="state_code" defaultValue={award.state_code ?? ""}>
                <input name="state_code" defaultValue={award.state_code ?? ""} className={inputClass} />
              </Field>
              <Field label="Award Amount" name="award_amount">
                <input name="award_amount" type="number" defaultValue={award.award_amount ?? ""} className={inputClass} />
              </Field>
              <Field label="Award ID" name="award_id">
                <input name="award_id" defaultValue={award.award_id ?? ""} className={inputClass} />
              </Field>
              <Field label="State Student ID" name="state_student_id">
                <input name="state_student_id" defaultValue={award.state_student_id ?? ""} className={inputClass} />
              </Field>
              <Field label="Award Year" name="award_year">
                <input name="award_year" defaultValue={award.award_year ?? ""} className={inputClass} />
              </Field>
              <Field label="Renewal Date" name="renewal_date">
                <input name="renewal_date" type="date" defaultValue={award.renewal_date ?? ""} className={inputClass} />
              </Field>
              <Field label="Notes" name="notes">
                <input name="notes" defaultValue={award.notes ?? ""} className={inputClass} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Save Award"}
                </button>
              </div>
            </form>
          </article>
        );
      })}
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

function Field({
  label,
  children,
}: {
  label: string;
  name?: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
