"use client";

import { useState, useTransition } from "react";
import {
  addSubstituteToPoolAction,
  addVolunteerAction,
  assignEmployeePositionAction,
  createCertification,
  createEmployee,
  createPayrollRecord,
  createPosition,
} from "@/lib/hr/actions";
import type { EmployeeRecord, Position } from "@/lib/hr/types";

interface HrFormsProps {
  employees: EmployeeRecord[];
  schools: { id: string; name: string }[];
  positions: Position[];
}

export function HrForms({ employees, schools, positions }: HrFormsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputClass = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm";
  const labelClass = "block text-sm font-medium text-slate-700";

  function wrap(action: (fd: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setMessage(null);
      startTransition(async () => {
        const result = await action(new FormData(e.currentTarget));
        setMessage(result.error ?? "Saved successfully.");
        if (!result.error) e.currentTarget.reset();
      });
    };
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {message && <div className="lg:col-span-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">{message}</div>}

      <form onSubmit={wrap(createEmployee)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Employee (triggers onboarding)</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={labelClass}>First Name</label><input name="first_name" required className={inputClass} /></div>
          <div><label className={labelClass}>Last Name</label><input name="last_name" required className={inputClass} /></div>
        </div>
        <div><label className={labelClass}>Job Title</label><input name="job_title" className={inputClass} /></div>
        <div><label className={labelClass}>School</label>
          <select name="school_id" required className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={labelClass}>Department</label><input name="department" className={inputClass} /></div>
          <div><label className={labelClass}>Hire Date</label><input name="hire_date" type="date" className={inputClass} /></div>
        </div>
        <div><label className={labelClass}>Type</label>
          <select name="employee_type" className={inputClass}>
            <option value="teacher">Teacher</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="contractor">Contractor</option>
          </select>
        </div>
        <div><label className={labelClass}>Emergency Contact</label><input name="emergency_contact_name" className={inputClass} /></div>
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Hire Employee</button>
      </form>

      <form onSubmit={wrap(createCertification)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Certification / License</h3>
        <div><label className={labelClass}>Employee</label>
          <select name="employee_id" required className={inputClass}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.employee_profiles?.display_name ?? e.id}</option>
            ))}
          </select>
        </div>
        <div><label className={labelClass}>Name</label><input name="certification_name" required className={inputClass} /></div>
        <div><label className={labelClass}>Type</label>
          <select name="certification_type" className={inputClass}>
            <option value="teaching_license">Teaching license</option>
            <option value="therapy_license">Therapy license</option>
            <option value="cpr">CPR</option>
            <option value="background_check">Background check</option>
            <option value="fingerprint">Fingerprinting</option>
            <option value="professional">Professional cert</option>
          </select>
        </div>
        <div><label className={labelClass}>Expiration</label><input name="expiration_date" type="date" className={inputClass} /></div>
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Add Certification</button>
      </form>

      <form onSubmit={wrap(assignEmployeePositionAction)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Assign Position</h3>
        <select name="employee_id" required className={inputClass}>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_profiles?.display_name ?? e.id}</option>)}
        </select>
        <select name="position_id" required className={inputClass}>
          {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <input type="hidden" name="is_primary" value="true" />
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Assign</button>
      </form>

      <form onSubmit={wrap(createPayrollRecord)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Payroll Record</h3>
        <select name="employee_id" required className={inputClass}>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_profiles?.display_name ?? e.id}</option>)}
        </select>
        <select name="school_id" required className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="pay_period_start" type="date" required className={inputClass} />
          <input name="pay_period_end" type="date" required className={inputClass} />
        </div>
        <input name="gross_pay" type="number" step="0.01" placeholder="Gross pay" required className={inputClass} />
        <input name="hours_worked" type="number" step="0.01" placeholder="Hours worked" className={inputClass} />
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Create Payroll</button>
      </form>

      <form onSubmit={wrap(addSubstituteToPoolAction)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Substitute Pool</h3>
        <select name="school_id" required className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input name="substitute_name" placeholder="Name" required className={inputClass} />
        <input name="contact_email" type="email" placeholder="Email" className={inputClass} />
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Add Substitute</button>
      </form>

      <form onSubmit={wrap(addVolunteerAction)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Volunteer</h3>
        <select name="school_id" required className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="first_name" placeholder="First name" required className={inputClass} />
          <input name="last_name" placeholder="Last name" required className={inputClass} />
        </div>
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Add Volunteer</button>
      </form>
    </div>
  );
}
