"use client";

import { useTransition } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { completeOnboardingTaskAction, submitLeaveRequestAction } from "@/lib/hr/actions";

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

interface EmployeePortalDashboardProps {
  data: {
    employee: Record<string, unknown>;
    employeeId: string;
    pendingLeave: Record<string, unknown>[];
    pendingTraining: Record<string, unknown>[];
    pendingOnboarding: Record<string, unknown>[];
    payrollHistory: Record<string, unknown>[];
    workload?: { sessionCount: number; weeklyHours: number };
  };
}

export function EmployeePortalDashboard({ data }: EmployeePortalDashboardProps) {
  const [pending, startTransition] = useTransition();
  const emp = data.employee;
  const ep = Array.isArray(emp.employee_profiles) ? emp.employee_profiles[0] : emp.employee_profiles;
  const epObj = ep as { first_name?: string; last_name?: string; job_title?: string } | null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Employee Portal</h1>
        <p className="text-slate-600">Welcome, {epObj?.first_name} — schedules, leave, training, and documents.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Weekly hours</p>
          <p className="text-2xl font-semibold">{data.workload?.weeklyHours ?? "—"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Sessions this week</p>
          <p className="text-2xl font-semibold">{data.workload?.sessionCount ?? "—"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Pending tasks</p>
          <p className="text-2xl font-semibold">{data.pendingOnboarding.length + data.pendingTraining.length}</p>
        </article>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/teacher" className="rounded-lg bg-brand-50 px-4 py-2 text-brand-700">Teacher workspace</Link>
        <Link href="/dashboard/scheduling" className="rounded-lg bg-brand-50 px-4 py-2 text-brand-700">Scheduling</Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await submitLeaveRequestAction(new FormData(e.currentTarget)); }); }}>
          <h2 className="font-semibold">Request leave</h2>
          <input type="hidden" name="employee_id" value={data.employeeId} />
          <input type="hidden" name="school_id" value={String(emp.school_id)} />
          <select name="leave_type" className={inputClass}>
            <option value="pto">PTO</option>
            <option value="sick">Sick</option>
            <option value="personal">Personal</option>
          </select>
          <input name="start_date" type="date" required className={inputClass} />
          <input name="end_date" type="date" required className={inputClass} />
          <textarea name="reason" placeholder="Reason" className={inputClass} />
          <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Submit</button>
        </form>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Onboarding & training</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.pendingOnboarding.map((t) => (
              <li key={t.id as string} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{t.title as string}</span>
                <button type="button" disabled={pending} className="text-xs text-brand-600" onClick={() => startTransition(async () => { const fd = new FormData(); fd.set("task_id", t.id as string); await completeOnboardingTaskAction(fd); })}>Complete</button>
              </li>
            ))}
            {data.pendingTraining.map((t) => (
              <li key={t.id as string} className="rounded-lg bg-amber-50 px-3 py-2">{t.course_title as string}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Payroll history</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.payrollHistory.map((p) => (
            <li key={p.id as string} className="flex justify-between">
              <span>{p.pay_period_start as string} – {p.pay_period_end as string}</span>
              <span>{formatCurrency(Number(p.net_pay))}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
