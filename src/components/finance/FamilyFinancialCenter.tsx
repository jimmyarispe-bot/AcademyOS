"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  acknowledgeFinancialAgreementAction,
  addBillingPayerAction,
  addPaymentMethodAction,
  applyLateFeeAction,
  applyWriteOffAction,
  createBillingCreditAction,
  createPaymentPlanAction,
  enrollAutopayAction,
  processRefundAction,
  recordPayment,
  registerFundingDocumentAction,
} from "@/lib/finance/actions";

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const btn = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

type StudentRef = { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;

function studentLabel(students: StudentRef) {
  if (!students) return "Student";
  const s = Array.isArray(students) ? students[0] : students;
  return s ? `${s.first_name} ${s.last_name}` : "Student";
}

interface FamilyFinancialCenterProps {
  familyId: string;
  profile: {
    family: { family_name: string; school_id: string };
    account: {
      id: string;
      balance: number;
      credit_balance: number;
      collections_status: string;
      autopay_enabled: boolean;
      sibling_discount_percent: number;
    } | null;
    guardians: { id: string; first_name: string; last_name: string; receives_billing: boolean; email: string | null }[];
    payers: { id: string; payer_name: string; responsibility_percent: number; is_primary: boolean; custody_basis: string | null }[];
    paymentMethods: { id: string; method_type: string; last_four: string | null; is_default: boolean }[];
    autopay: { id: string; status: string; day_of_month: number | null }[];
    paymentPlans: { id: string; name: string; total_amount: number; installment_amount: number; status: string }[];
    credits: { id: string; amount: number; remaining_amount: number; reason: string | null }[];
    invoices: { id: string; invoice_number: string; total_amount: number; amount_paid: number; invoice_status: string; due_date: string; family_responsibility?: number }[];
    students: { id: string; first_name: string; last_name: string; program: string | null }[];
    payments?: {
      id: string;
      amount: number;
      payment_method: string;
      receipt_number: string | null;
      paid_at: string | null;
      invoices?: { invoice_number: string } | { invoice_number: string }[];
    }[];
    scholarships?: {
      id: string;
      approved_amount: number | null;
      remaining_award_balance: number | null;
      scholarship_type: string | null;
      renewal_date: string | null;
      expires_on: string | null;
      conditions: string | null;
      students?: StudentRef;
    }[];
    stateFunding?: {
      id: string;
      funding_category: string;
      program_name: string | null;
      award_amount: number | null;
      verification_status: string;
      payment_status: string;
      renewal_date: string | null;
      state_code: string | null;
      students?: StudentRef;
    }[];
    adjustments?: {
      id: string;
      adjustment_type: string;
      amount: number;
      reason: string;
      created_at: string;
    }[];
  };
  portalMode?: boolean;
}

export function FamilyFinancialCenter({ familyId, profile, portalMode }: FamilyFinancialCenterProps) {
  const [pending, startTransition] = useTransition();
  const account = profile.account;
  const payments = profile.payments ?? [];
  const scholarships = profile.scholarships ?? [];
  const stateFunding = profile.stateFunding ?? [];
  const adjustments = profile.adjustments ?? [];

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Outstanding balance</p>
          <p className="text-2xl font-semibold text-amber-600">${Number(account?.balance ?? 0).toLocaleString()}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Credits available</p>
          <p className="text-2xl font-semibold text-emerald-600">${Number(account?.credit_balance ?? 0).toLocaleString()}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Collections status</p>
          <p className="text-lg font-medium capitalize text-slate-900">{account?.collections_status ?? "—"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">AutoPay</p>
          <p className="text-lg font-medium text-slate-900">{profile.autopay.length ? "Enrolled" : account?.autopay_enabled ? "Enabled" : "Not enrolled"}</p>
        </article>
      </section>

      {!portalMode && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Responsible payers</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {profile.payers.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.payer_name}{p.is_primary ? " (primary)" : ""}</span>
                <span>{p.responsibility_percent}% · {p.custody_basis?.replace(/_/g, " ") ?? "—"}</span>
              </li>
            ))}
            {!profile.payers.length && profile.guardians.filter((g) => g.receives_billing).map((g) => (
              <li key={g.id}>{g.first_name} {g.last_name} — billing contact</li>
            ))}
          </ul>
          {account && (
            <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { const fd = new FormData(e.currentTarget); fd.set("family_id", familyId); fd.set("billing_account_id", account.id); await addBillingPayerAction(fd); }); }}>
              <input type="hidden" name="billing_account_id" value={account.id} />
              <input type="hidden" name="family_id" value={familyId} />
              <input name="payer_name" placeholder="Payer name" className={inputClass} required />
              <input name="payer_email" placeholder="Email" className={inputClass} />
              <input name="responsibility_percent" type="number" placeholder="%" defaultValue={50} className={inputClass} />
              <select name="custody_basis" className={inputClass}>
                <option value="primary">Primary custody</option>
                <option value="joint">Joint</option>
                <option value="split">Split</option>
              </select>
              <button type="submit" disabled={pending} className={btn}>Add payer</button>
            </form>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Invoices</h3>
        <ul className="mt-3 space-y-3">
          {profile.invoices.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
              <div>
                <p className="font-medium">{inv.invoice_number}</p>
                <p className="text-slate-500">Due {inv.due_date} · {inv.invoice_status}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">${Number(inv.total_amount - inv.amount_paid).toLocaleString()} due</p>
                {portalMode && inv.invoice_status !== "paid" && account && (
                  <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { const fd = new FormData(e.currentTarget); fd.set("invoice_id", inv.id); await recordPayment(fd); }); }}>
                    <input type="hidden" name="invoice_id" value={inv.id} />
                    <input name="amount" type="number" step="0.01" defaultValue={inv.total_amount - inv.amount_paid} className="w-24 rounded border px-2 py-1 text-xs" />
                    <select name="payment_method" className="rounded border px-2 py-1 text-xs">
                      <option value="credit_card">Card</option>
                      <option value="ach">ACH</option>
                    </select>
                    <button type="submit" disabled={pending} className="text-xs text-brand-600">Pay (Square planned)</button>
                  </form>
                )}
              </div>
            </li>
          ))}
          {!profile.invoices.length && <li className="text-slate-500">No invoices yet.</li>}
        </ul>
      </section>

      {(portalMode || payments.length > 0) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Payment history</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {payments.map((p) => {
              const inv = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices;
              return (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span>
                    {p.paid_at?.split("T")[0] ?? "—"} · {inv?.invoice_number ?? "Payment"} · {p.payment_method.replace(/_/g, " ")}
                  </span>
                  <span className="font-medium">${Number(p.amount).toLocaleString()}</span>
                  {p.receipt_number && (
                    <span className="w-full text-xs text-slate-500">Receipt {p.receipt_number}</span>
                  )}
                </li>
              );
            })}
            {!payments.length && <li className="text-slate-500">No payments recorded yet.</li>}
          </ul>
        </section>
      )}

      {(portalMode || scholarships.length > 0) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Scholarship awards</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {scholarships.map((s) => (
              <li key={s.id} className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                <p className="font-medium">{studentLabel(s.students ?? null)}</p>
                <p className="text-slate-600">
                  {s.scholarship_type?.replace(/_/g, " ") ?? "Scholarship"} · Approved ${Number(s.approved_amount ?? 0).toLocaleString()}
                  {s.remaining_award_balance != null && ` · Remaining $${Number(s.remaining_award_balance).toLocaleString()}`}
                </p>
                {(s.renewal_date || s.expires_on) && (
                  <p className="mt-1 text-xs text-slate-500">
                    {s.renewal_date && `Renewal ${s.renewal_date}`}
                    {s.expires_on && ` · Expires ${s.expires_on}`}
                  </p>
                )}
              </li>
            ))}
            {!scholarships.length && <li className="text-slate-500">No scholarship awards on file.</li>}
          </ul>
        </section>
      )}

      {(portalMode || stateFunding.length > 0) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">State funding & ESA</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {stateFunding.map((f) => (
              <li key={f.id} className="rounded-lg border border-sky-100 bg-sky-50/50 p-3">
                <p className="font-medium">{studentLabel(f.students ?? null)}</p>
                <p className="capitalize text-slate-600">
                  {f.funding_category.replace(/_/g, " ")}
                  {f.program_name ? ` · ${f.program_name}` : ""}
                  {f.state_code ? ` (${f.state_code})` : ""}
                </p>
                <p className="mt-1 text-slate-600">
                  Award ${Number(f.award_amount ?? 0).toLocaleString()} · {f.verification_status} · {f.payment_status}
                </p>
              </li>
            ))}
            {!stateFunding.length && <li className="text-slate-500">No state funding records yet.</li>}
          </ul>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">Payment methods</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {profile.paymentMethods.map((m) => (
              <li key={m.id} className="capitalize">{m.method_type.replace(/_/g, " ")}{m.last_four ? ` ·••• ${m.last_four}` : ""}{m.is_default ? " (default)" : ""}</li>
            ))}
          </ul>
          {account && (
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { const fd = new FormData(e.currentTarget); fd.set("family_id", familyId); await addPaymentMethodAction(fd); }); }}>
              <input type="hidden" name="billing_account_id" value={account.id} />
              <input type="hidden" name="family_id" value={familyId} />
              <select name="method_type" className="rounded border px-2 py-1 text-sm">
                <option value="credit_card">Credit card</option>
                <option value="ach">ACH</option>
              </select>
              <input name="last_four" placeholder="Last 4" className="w-20 rounded border px-2 py-1 text-sm" />
              <button type="submit" disabled={pending} className="text-xs text-brand-600">Add method</button>
            </form>
          )}
          {portalMode && account && !profile.autopay.length && profile.paymentMethods.length > 0 && (
            <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await enrollAutopayAction(new FormData(e.currentTarget)); }); }}>
              <input type="hidden" name="billing_account_id" value={account.id} />
              <input type="hidden" name="payment_method_id" value={profile.paymentMethods.find((m) => m.is_default)?.id ?? profile.paymentMethods[0]?.id} />
              <label className="text-xs text-slate-600">
                AutoPay day
                <input name="day_of_month" type="number" min={1} max={28} defaultValue={1} className="ml-1 w-14 rounded border px-1 py-0.5" />
              </label>
              <button type="submit" disabled={pending} className="text-xs text-brand-600">Enroll in AutoPay</button>
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">Payment plans & credits</h3>
          {profile.paymentPlans.map((p) => (
            <p key={p.id} className="mt-2 text-sm">{p.name} — ${Number(p.installment_amount).toLocaleString()}/installment ({p.status})</p>
          ))}
          {profile.credits.map((c) => (
            <p key={c.id} className="mt-1 text-sm text-emerald-700">Credit ${Number(c.remaining_amount).toLocaleString()} — {c.reason ?? "Available"}</p>
          ))}
          {adjustments.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500">Recent adjustments</p>
              {adjustments.map((a) => (
                <p key={a.id} className="mt-1 text-xs text-slate-600 capitalize">
                  {a.adjustment_type.replace(/_/g, " ")} ${Number(a.amount).toLocaleString()} — {a.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      {portalMode && account && profile.students.length > 0 && (
        <section className="grid gap-4 lg:grid-cols-2">
          <form className="rounded-xl border border-slate-200 p-4 space-y-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await registerFundingDocumentAction(new FormData(e.currentTarget)); }); }}>
            <h4 className="font-medium">Upload funding document</h4>
            <p className="text-xs text-slate-500">Register award letters or verification documents for finance review.</p>
            <select name="student_id" className={inputClass} required>
              {profile.students.map((s) => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
              ))}
            </select>
            <select name="document_type" className={inputClass}>
              <option value="award_letter">Award letter</option>
              <option value="funding_verification">Funding verification</option>
              <option value="esa_voucher">ESA / voucher</option>
            </select>
            <input name="file_name" placeholder="Document file name" className={inputClass} required />
            <button type="submit" disabled={pending} className={btn}>Submit document</button>
          </form>
          <form className="rounded-xl border border-slate-200 p-4 space-y-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { const fd = new FormData(e.currentTarget); fd.set("family_id", familyId); await acknowledgeFinancialAgreementAction(fd); }); }}>
            <input type="hidden" name="billing_account_id" value={account.id} />
            <input type="hidden" name="family_id" value={familyId} />
            <h4 className="font-medium">Financial agreement</h4>
            <p className="text-xs text-slate-600">
              I acknowledge tuition, payment plan, and refund policies for {profile.family.family_name}.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" required />
              I agree to the financial terms
            </label>
            <button type="submit" disabled={pending} className={btn}>Sign agreement</button>
          </form>
        </section>
      )}

      {!portalMode && account && (
        <section className="grid gap-4 lg:grid-cols-2">
          <form className="rounded-xl border border-slate-200 p-4 space-y-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await createBillingCreditAction(new FormData(e.currentTarget)); }); }}>
            <input type="hidden" name="billing_account_id" value={account.id} />
            <h4 className="font-medium">Issue credit</h4>
            <input name="amount" type="number" step="0.01" placeholder="Amount" className={inputClass} required />
            <input name="reason" placeholder="Reason" className={inputClass} />
            <button type="submit" disabled={pending} className={btn}>Add credit</button>
          </form>
          <form className="rounded-xl border border-slate-200 p-4 space-y-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await createPaymentPlanAction(new FormData(e.currentTarget)); }); }}>
            <input type="hidden" name="billing_account_id" value={account.id} />
            <h4 className="font-medium">Payment plan</h4>
            <input name="name" placeholder="Plan name" className={inputClass} required />
            <input name="total_amount" type="number" placeholder="Total" className={inputClass} required />
            <input name="installment_amount" type="number" placeholder="Installment" className={inputClass} required />
            <input name="installment_count" type="number" placeholder="# installments" className={inputClass} required />
            <input name="start_date" type="date" className={inputClass} required />
            <button type="submit" disabled={pending} className={btn}>Create plan</button>
          </form>
        </section>
      )}

      {!portalMode && account && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Accounts receivable</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <form className="space-y-2 rounded-lg border border-slate-100 p-3" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await applyLateFeeAction(new FormData(e.currentTarget)); }); }}>
              <h4 className="text-sm font-medium">Late fee</h4>
              <input name="invoice_id" placeholder="Invoice ID" className={inputClass} required />
              <input name="amount" type="number" step="0.01" placeholder="Amount" className={inputClass} required />
              <input name="reason" placeholder="Reason" defaultValue="Late payment fee" className={inputClass} />
              <button type="submit" disabled={pending} className="text-sm text-brand-600">Apply late fee</button>
            </form>
            <form className="space-y-2 rounded-lg border border-slate-100 p-3" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await applyWriteOffAction(new FormData(e.currentTarget)); }); }}>
              <h4 className="text-sm font-medium">Write-off</h4>
              <input name="invoice_id" placeholder="Invoice ID" className={inputClass} required />
              <input name="amount" type="number" step="0.01" placeholder="Amount" className={inputClass} required />
              <input name="reason" placeholder="Reason" className={inputClass} required />
              <button type="submit" disabled={pending} className="text-sm text-brand-600">Write off</button>
            </form>
            <form className="space-y-2 rounded-lg border border-slate-100 p-3" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await processRefundAction(new FormData(e.currentTarget)); }); }}>
              <input type="hidden" name="billing_account_id" value={account.id} />
              <h4 className="text-sm font-medium">Refund</h4>
              <input name="invoice_id" placeholder="Invoice ID (optional)" className={inputClass} />
              <input name="amount" type="number" step="0.01" placeholder="Amount" className={inputClass} required />
              <input name="reason" placeholder="Reason" className={inputClass} required />
              <button type="submit" disabled={pending} className="text-sm text-brand-600">Process refund</button>
            </form>
          </div>
        </section>
      )}

      {!portalMode && (
        <p className="text-sm text-slate-500">
          State funding & scholarships:{" "}
          <Link href="/dashboard/admissions/state-funding" className="text-brand-600 hover:underline">State Funding Center</Link>
          {" · "}
          <Link href="/dashboard/scholarships" className="text-brand-600 hover:underline">Scholarship Center</Link>
        </p>
      )}
    </div>
  );
}
