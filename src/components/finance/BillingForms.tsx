"use client";

import { useState, useTransition } from "react";
import {
  applyLateFeeAction,
  applyWriteOffAction,
  buildForecastAction,
  createBillingAccount,
  createInvoice,
  createTuitionInvoiceFromPlanAction,
  createTuitionPlan,
  processRefundAction,
  recordPayment,
} from "@/lib/finance/actions";
import { PROGRAMS } from "@/lib/constants/programs";
import type { BillingAccount, TuitionPlan } from "@/lib/finance/queries";

interface BillingFormsProps {
  families: { id: string; family_name: string; school_id: string }[];
  students: { id: string; first_name: string; last_name: string; family_id: string | null }[];
  schools: { id: string; name: string }[];
  plans: TuitionPlan[];
  accounts: BillingAccount[];
}

export function BillingForms({ families, students, schools, plans, accounts }: BillingFormsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputClass = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm";
  const labelClass = "block text-sm font-medium text-slate-700";

  function wrap(action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setMessage(null);
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const result = await action(fd);
        setMessage(result.error ? result.error : "Saved successfully.");
        if (!result.error) e.currentTarget.reset();
      });
    };
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {message && (
        <div className="lg:col-span-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div>
      )}

      <form onSubmit={wrap(createBillingAccount)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Billing Account</h3>
        <div>
          <label className={labelClass}>Family</label>
          <select name="family_id" required className={inputClass}>
            <option value="">Select family</option>
            {families.map((f) => <option key={f.id} value={f.id}>{f.family_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>School</label>
          <select name="school_id" required className={inputClass}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Sibling Discount Student (5% on one sibling)</label>
          <select name="sibling_discount_student_id" className={inputClass} defaultValue="">
            <option value="">None</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Create Account</button>
      </form>

      <form onSubmit={wrap(createInvoice)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Invoice</h3>
        <div>
          <label className={labelClass}>Billing Account</label>
          <select name="billing_account_id" required className={inputClass}>
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.families?.family_name ?? a.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Student (for sibling discount)</label>
          <select name="student_id" className={inputClass} defaultValue="">
            <option value="">None</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Invoice Number</label>
          <input name="invoice_number" required className={inputClass} placeholder="INV-001" />
        </div>
        <div>
          <label className={labelClass}>Subtotal</label>
          <input name="subtotal" type="number" step="0.01" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Due Date</label>
          <input name="due_date" type="date" required className={inputClass} />
        </div>
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Create Invoice</button>
      </form>

      <form onSubmit={wrap(createTuitionInvoiceFromPlanAction)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Invoice from Tuition Plan</h3>
        <p className="text-xs text-slate-500">Applies sibling discount, scholarships, and state funding credits automatically.</p>
        <div>
          <label className={labelClass}>Billing Account</label>
          <select name="billing_account_id" required className={inputClass}>
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.families?.family_name ?? a.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Student</label>
          <select name="student_id" required className={inputClass}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Tuition Plan</label>
          <select name="tuition_plan_id" required className={inputClass}>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} (${Number(p.annual_amount).toLocaleString()})</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Invoice Number</label>
          <input name="invoice_number" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Due Date</label>
          <input name="due_date" type="date" required className={inputClass} />
        </div>
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Generate Invoice</button>
      </form>

      <form onSubmit={wrap(recordPayment)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Record Payment</h3>
        <div>
          <label className={labelClass}>Invoice ID</label>
          <input name="invoice_id" required className={inputClass} placeholder="Invoice UUID" />
        </div>
        <div>
          <label className={labelClass}>Amount</label>
          <input name="amount" type="number" step="0.01" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Method</label>
          <select name="payment_method" className={inputClass}>
            <option value="ach">ACH</option>
            <option value="check">Check</option>
            <option value="credit_card">Credit Card</option>
            <option value="esa">ESA</option>
          </select>
        </div>
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Record Payment</button>
      </form>

      <form onSubmit={wrap(createTuitionPlan)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Tuition Plan</h3>
        <div>
          <label className={labelClass}>School</label>
          <select name="school_id" required className={inputClass}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Name</label>
          <input name="name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Program</label>
          <select name="program" className={inputClass} defaultValue="">
            <option value="">All programs</option>
            {PROGRAMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Service Type</label>
          <select name="service_type" className={inputClass}>
            <option value="tuition">Tuition</option>
            <option value="therapy">Therapy</option>
            <option value="tutoring">Tutoring</option>
            <option value="summer">Summer program</option>
            <option value="hourly">Hourly services</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Billing Frequency</label>
          <select name="billing_frequency" className={inputClass}>
            <option value="annual">Annual</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
            <option value="hourly">Hourly</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Annual Amount</label>
          <input name="annual_amount" type="number" step="0.01" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Hourly Rate (optional)</label>
          <input name="hourly_rate" type="number" step="0.01" className={inputClass} />
        </div>
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Create Plan</button>
      </form>

      <form onSubmit={wrap(buildForecastAction)} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Build Forecast Snapshot</h3>
        <div>
          <label className={labelClass}>School</label>
          <select name="school_id" required className={inputClass}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">Build Forecast</button>
      </form>

      <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5">
        <h3 className="font-semibold text-slate-900">AR Adjustments</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <form onSubmit={wrap(applyLateFeeAction)} className="space-y-2 rounded-lg border border-slate-100 p-3">
            <h4 className="text-sm font-medium">Late fee</h4>
            <input name="invoice_id" placeholder="Invoice ID" className={inputClass} required />
            <input name="amount" type="number" step="0.01" placeholder="Amount" className={inputClass} required />
            <input name="reason" placeholder="Reason" defaultValue="Late payment fee" className={inputClass} />
            <button type="submit" disabled={isPending} className="text-sm text-brand-600">Apply</button>
          </form>
          <form onSubmit={wrap(applyWriteOffAction)} className="space-y-2 rounded-lg border border-slate-100 p-3">
            <h4 className="text-sm font-medium">Write-off</h4>
            <input name="invoice_id" placeholder="Invoice ID" className={inputClass} required />
            <input name="amount" type="number" step="0.01" placeholder="Amount" className={inputClass} required />
            <input name="reason" placeholder="Reason" className={inputClass} required />
            <button type="submit" disabled={isPending} className="text-sm text-brand-600">Write off</button>
          </form>
          <form onSubmit={wrap(processRefundAction)} className="space-y-2 rounded-lg border border-slate-100 p-3">
            <h4 className="text-sm font-medium">Refund</h4>
            <select name="billing_account_id" required className={inputClass}>
              <option value="">Billing account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.families?.family_name ?? a.id}</option>
              ))}
            </select>
            <input name="invoice_id" placeholder="Invoice ID (optional)" className={inputClass} />
            <input name="amount" type="number" step="0.01" placeholder="Amount" className={inputClass} required />
            <input name="reason" placeholder="Reason" className={inputClass} required />
            <button type="submit" disabled={isPending} className="text-sm text-brand-600">Refund</button>
          </form>
        </div>
      </div>
    </div>
  );
}
