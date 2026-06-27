"use client";

import { useTransition } from "react";
import { saveFundingProgram } from "@/lib/admissions/sprint15-actions";
import type { FundingProgram } from "@/lib/admissions/state-funding";

interface FundingProgramCatalogTableProps {
  programs: FundingProgram[];
  schools: { id: string; name: string }[];
}

export function FundingProgramCatalogTable({ programs, schools }: FundingProgramCatalogTableProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Agency</th>
              <th className="px-4 py-3">Max Award</th>
              <th className="px-4 py-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((program) => (
              <tr key={program.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{program.program_name}</p>
                  <p className="text-xs text-slate-500">{program.program_code}</p>
                </td>
                <td className="px-4 py-3">{program.state_code}</td>
                <td className="px-4 py-3">{program.funding_agency}</td>
                <td className="px-4 py-3">
                  {program.maximum_award != null
                    ? `$${program.maximum_award.toLocaleString()}`
                    : "—"}
                </td>
                <td className="px-4 py-3">{program.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4"
        action={(fd) => {
          startTransition(async () => {
            await saveFundingProgram(fd);
          });
        }}
      >
        <h3 className="text-sm font-semibold text-slate-900">Add Funding Program</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="school_id" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Org-wide</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            name="program_code"
            placeholder="Program code"
            required
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            name="program_name"
            placeholder="Program name"
            required
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            name="state_code"
            placeholder="State code (e.g. FL)"
            required
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            name="funding_agency"
            placeholder="Funding agency"
            required
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            name="maximum_award"
            type="number"
            placeholder="Maximum award"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Save program
        </button>
      </form>
    </div>
  );
}
