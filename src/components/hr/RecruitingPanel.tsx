"use client";

import { useTransition } from "react";
import { createJobApplicationAction, createJobPostingAction, updateApplicationStageAction } from "@/lib/hr/actions";

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

interface RecruitingPanelProps {
  jobs: Record<string, unknown>[];
  applications: Record<string, unknown>[];
  schools: { id: string; name: string }[];
}

export function RecruitingPanel({ jobs, applications, schools }: RecruitingPanelProps) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-8">
      <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 max-w-lg" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await createJobPostingAction(new FormData(e.currentTarget)); e.currentTarget.reset(); }); }}>
        <h2 className="font-semibold">Post a job</h2>
        <select name="school_id" required className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input name="title" placeholder="Job title" required className={inputClass} />
        <input name="department" placeholder="Department" className={inputClass} />
        <textarea name="description" placeholder="Description" rows={3} className={inputClass} />
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Publish</button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Open postings</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {jobs.filter((j) => j.status === "open").map((j) => (
            <li key={j.id as string} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="font-medium">{j.title as string}</p>
              <p className="text-slate-500">{j.department as string}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Candidate pipeline</h2>
        <ul className="mt-3 space-y-3">
          {applications.map((a) => (
            <li key={a.id as string} className="rounded-lg border border-slate-100 p-3 text-sm">
              <p className="font-medium">{a.candidate_name as string}</p>
              <p className="text-slate-500">{a.candidate_email as string}</p>
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { const fd = new FormData(e.currentTarget); fd.set("application_id", a.id as string); await updateApplicationStageAction(fd); }); }}>
                <input type="hidden" name="application_id" value={a.id as string} />
                <select name="pipeline_stage" defaultValue={a.pipeline_stage as string} className="rounded border px-2 py-1 text-xs capitalize">
                  {["applied", "screening", "interview", "reference_check", "background_check", "offer", "hired", "rejected"].map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <button type="submit" disabled={pending} className="text-xs text-brand-600">Update</button>
              </form>
            </li>
          ))}
        </ul>
        <form className="mt-6 space-y-2 border-t pt-4" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await createJobApplicationAction(new FormData(e.currentTarget)); }); }}>
          <h3 className="text-sm font-medium">Add candidate</h3>
          <select name="job_posting_id" required className={inputClass}>
            {jobs.map((j) => <option key={j.id as string} value={j.id as string}>{j.title as string}</option>)}
          </select>
          <input name="candidate_name" placeholder="Name" required className={inputClass} />
          <input name="candidate_email" type="email" placeholder="Email" required className={inputClass} />
          <button type="submit" disabled={pending} className="text-sm text-brand-600">Add to pipeline</button>
        </form>
      </section>
    </div>
  );
}
