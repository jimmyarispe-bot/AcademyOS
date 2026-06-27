"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface FundingExportFormProps {
  states: string[];
  programs: { id: string; program_name: string }[];
  schools: { id: string; name: string }[];
}

export function FundingExportForm({ states, programs, schools }: FundingExportFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleExport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of fd.entries()) {
      if (value) params.set(key, String(value));
    }
    router.push(`/api/admissions/funding-export?${params.toString()}`);
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  return (
    <form onSubmit={handleExport} className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900">Export State Funding Data</h3>
      <p className="mt-1 text-xs text-slate-500">Download Excel-compatible CSV with filtered award records</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-slate-500">State</label>
          <select name="state" defaultValue={searchParams.get("state") ?? ""} className={inputClass}>
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Program</label>
          <select name="programId" defaultValue={searchParams.get("programId") ?? ""} className={inputClass}>
            <option value="">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.program_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">School</label>
          <select name="schoolId" defaultValue={searchParams.get("schoolId") ?? ""} className={inputClass}>
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Award Year</label>
          <input name="awardYear" defaultValue={searchParams.get("awardYear") ?? ""} className={inputClass} placeholder="e.g. 2025-26" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Verification Status</label>
          <select name="verificationStatus" defaultValue={searchParams.get("verificationStatus") ?? ""} className={inputClass}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="documents_submitted">Documents Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Export to Excel (CSV)
      </button>
    </form>
  );
}
