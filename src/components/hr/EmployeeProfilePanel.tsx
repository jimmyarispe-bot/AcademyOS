"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/format";

interface EmployeeProfilePanelProps {
  profile: {
    employee: Record<string, unknown>;
    supervisor: Record<string, unknown> | null;
    positions: Record<string, unknown>[];
    certifications: Record<string, unknown>[];
    serviceHistory: Record<string, unknown>[];
    onboarding: Record<string, unknown>[];
    evaluations: Record<string, unknown>[];
    training: Record<string, unknown>[];
    documents: Record<string, unknown>[];
    payroll: Record<string, unknown>[];
    leaveRequests: Record<string, unknown>[];
  };
}

export function EmployeeProfilePanel({ profile }: EmployeeProfilePanelProps) {
  const emp = profile.employee;
  const ep = Array.isArray(emp.employee_profiles) ? emp.employee_profiles[0] : emp.employee_profiles;
  const epObj = ep as { first_name?: string; last_name?: string; job_title?: string; contact_email?: string; meet_link?: string; emergency_contact_name?: string } | null;
  const school = emp.schools as { name?: string } | { name?: string }[] | null;
  const schoolName = Array.isArray(school) ? school[0]?.name : school?.name;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/hr" className="text-sm text-brand-600 hover:underline">← HR</Link>
        <h1 className="mt-2 text-3xl font-bold">{epObj?.first_name} {epObj?.last_name}</h1>
        <p className="text-slate-600">{epObj?.job_title ?? "Staff"} · {schoolName}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Type</p>
          <p className="font-medium capitalize">{String(emp.employee_type)}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Hire date</p>
          <p className="font-medium">{String(emp.hire_date ?? "—")}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Department</p>
          <p className="font-medium">{String(emp.department ?? "—")}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Certifications</p>
          <p className="font-medium">{profile.certifications.length}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Contact & emergency</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            <li>Email: {epObj?.contact_email ?? "—"}</li>
            <li>Meet link: {epObj?.meet_link ? <a href={epObj.meet_link} className="text-brand-600">Join</a> : "—"}</li>
            <li>Emergency: {epObj?.emergency_contact_name ?? "—"}</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Onboarding</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {profile.onboarding.map((t) => (
              <li key={t.id as string} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{t.title as string}</span>
                <span className="capitalize text-slate-500">{t.status as string}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Credentials & certifications</h2>
        <table className="mt-3 min-w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th className="py-2">Name</th><th>Type</th><th>Expires</th><th>Status</th></tr></thead>
          <tbody>
            {profile.certifications.map((c) => (
              <tr key={c.id as string} className="border-t border-slate-100">
                <td className="py-2">{c.certification_name as string}</td>
                <td className="capitalize">{(c.certification_type as string)?.replace(/_/g, " ") ?? "—"}</td>
                <td>{(c.expiration_date as string) ?? "—"}</td>
                <td className="capitalize">{c.status as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Service history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {profile.serviceHistory.map((s) => (
              <li key={s.id as string}>{s.effective_date as string} — {s.title as string}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Document vault</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {profile.documents.map((d) => (
              <li key={d.id as string} className="capitalize">{d.document_type as string} — {d.file_name as string}</li>
            ))}
            {!profile.documents.length && <li className="text-slate-500">No documents on file.</li>}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Payroll history</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {profile.payroll.map((p) => (
            <li key={p.id as string} className="flex justify-between">
              <span>{p.pay_period_start as string} – {p.pay_period_end as string}</span>
              <span>{formatCurrency(Number(p.gross_pay))} · {p.pay_status as string}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
