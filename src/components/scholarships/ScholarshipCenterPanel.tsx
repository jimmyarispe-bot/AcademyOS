"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format";
import { createScholarshipFundAction } from "@/lib/finance/actions";
import type { ScholarshipFundRow } from "@/lib/scholarships/queries";

interface AwardRow {
  id: string;
  approved_amount: number | null;
  remaining_award_balance: number | null;
  scholarship_status: string;
  scholarship_type: string | null;
  renewal_date: string | null;
  expires_on: string | null;
  conditions: string | null;
  student_id: string | null;
  students?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
}

interface ScholarshipCenterPanelProps {
  funds: ScholarshipFundRow[];
  awards: AwardRow[];
  schools: { id: string; name: string }[];
}

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

function studentName(award: AwardRow) {
  const s = award.students;
  if (!s) return "Student";
  const row = Array.isArray(s) ? s[0] : s;
  return row ? `${row.first_name} ${row.last_name}` : "Student";
}

export function ScholarshipCenterPanel({ funds, awards, schools }: ScholarshipCenterPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Scholarship Funds</h2>
        <p className="mt-1 text-sm text-slate-500">
          Internal, donor, merit, need-based, and restricted funds with remaining balances.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Fund</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Donor</th>
                <th className="py-2 pr-4">Allocated</th>
                <th className="py-2">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => (
                <tr key={f.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{f.fund_name}</td>
                  <td className="py-2 pr-4 capitalize">{f.fund_type.replace(/_/g, " ")}</td>
                  <td className="py-2 pr-4">{f.donor_name ?? "—"}</td>
                  <td className="py-2 pr-4">{formatCurrency(Number(f.total_allocation))}</td>
                  <td className="py-2">{formatCurrency(Number(f.remaining_balance))}</td>
                </tr>
              ))}
              {!funds.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">No scholarship funds yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            startTransition(async () => {
              const result = await createScholarshipFundAction(new FormData(e.currentTarget));
              setMessage(result.error ?? "Fund created.");
              if (!result.error) e.currentTarget.reset();
            });
          }}
        >
          <h3 className="sm:col-span-2 lg:col-span-3 font-medium text-slate-900">Add fund</h3>
          <select name="school_id" required className={inputClass}>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input name="fund_name" placeholder="Fund name" required className={inputClass} />
          <select name="fund_type" required className={inputClass}>
            <option value="internal">Internal</option>
            <option value="outside">Outside</option>
            <option value="need_based">Need-based</option>
            <option value="merit">Merit</option>
            <option value="restricted">Restricted</option>
            <option value="donor">Donor-funded</option>
          </select>
          <input name="donor_name" placeholder="Donor (optional)" className={inputClass} />
          <input name="total_allocation" type="number" step="0.01" placeholder="Total allocation" required className={inputClass} />
          <input name="restrictions" placeholder="Restrictions (optional)" className={inputClass} />
          <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            Create fund
          </button>
          {message && <p className="sm:col-span-2 lg:col-span-3 text-sm text-slate-600">{message}</p>}
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Approved Awards</h2>
        <p className="mt-1 text-sm text-slate-500">Renewals, conditions, and remaining award balances.</p>
        <ul className="mt-4 space-y-3">
          {awards.map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{studentName(a)}</p>
                  <p className="text-slate-500 capitalize">{a.scholarship_type?.replace(/_/g, " ") ?? "Scholarship"}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(Number(a.approved_amount ?? 0))}</p>
                  <p className="text-emerald-700">
                    Remaining {formatCurrency(Number(a.remaining_award_balance ?? a.approved_amount ?? 0))}
                  </p>
                </div>
              </div>
              {(a.renewal_date || a.expires_on || a.conditions) && (
                <p className="mt-2 text-slate-600">
                  {a.renewal_date && <>Renewal {a.renewal_date} · </>}
                  {a.expires_on && <>Expires {a.expires_on} · </>}
                  {a.conditions && <span>{a.conditions}</span>}
                </p>
              )}
            </li>
          ))}
          {!awards.length && <li className="text-slate-500">No approved awards yet.</li>}
        </ul>
      </section>
    </div>
  );
}
