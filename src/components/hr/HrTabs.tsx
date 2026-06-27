import { EmployeeList } from "./EmployeeList";
import { HrForms } from "./HrForms";
import { RecruitingPanel } from "./RecruitingPanel";
import { WorkforceAnalyticsPanel } from "./WorkforceAnalyticsPanel";
import { approvePayrollFormAction } from "@/lib/hr/actions";
import { formatCurrency } from "@/lib/format";
import type {
  Certification,
  EmployeeRecord,
  PayrollRecord,
  Position,
} from "@/lib/hr/types";

interface HrTabsProps {
  view: string;
  employees: EmployeeRecord[];
  positions: Position[];
  certifications: Certification[];
  payroll: PayrollRecord[];
  schools: { id: string; name: string }[];
  jobs: Record<string, unknown>[];
  applications: Record<string, unknown>[];
  compliance: { expiringCertifications: Record<string, unknown>[]; pendingOnboarding: Record<string, unknown>[] };
  analytics: Parameters<typeof WorkforceAnalyticsPanel>[0]["analytics"];
  orgChart: Parameters<typeof WorkforceAnalyticsPanel>[0]["orgChart"];
  substitutes: Record<string, unknown>[];
  volunteers: Record<string, unknown>[];
  canRunPayroll?: boolean;
}

export function HrTabs({
  view,
  employees,
  positions,
  certifications,
  payroll,
  schools,
  jobs,
  applications,
  compliance,
  analytics,
  orgChart,
  substitutes,
  volunteers,
  canRunPayroll = false,
}: HrTabsProps) {
  if (view === "recruiting") {
    return <RecruitingPanel jobs={jobs} applications={applications} schools={schools} />;
  }

  if (view === "compliance") {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Expiring certifications</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {compliance.expiringCertifications.map((c) => (
              <li key={c.id as string} className="rounded-lg bg-amber-50 px-3 py-2">
                {c.certification_name as string} — expires {c.expiration_date as string}
              </li>
            ))}
            {!compliance.expiringCertifications.length && <li className="text-slate-500">No certifications expiring within 90 days.</li>}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Pending onboarding</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {compliance.pendingOnboarding.map((t) => (
              <li key={t.id as string} className="rounded-lg bg-slate-50 px-3 py-2">{t.title as string} — due {t.due_date as string ?? "—"}</li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  if (view === "analytics") {
    return <WorkforceAnalyticsPanel analytics={analytics} orgChart={orgChart} />;
  }

  if (view === "workforce") {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Substitute pool</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {substitutes.map((s) => (
              <li key={s.id as string} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-medium">{s.substitute_name as string}</p>
                <p className="text-slate-500">{s.contact_email as string ?? "—"}</p>
                <p className="text-xs capitalize text-slate-500">
                  {s.credentials_verified ? "Credentials verified" : "Pending verification"} · {s.status as string}
                </p>
              </li>
            ))}
            {!substitutes.length && <li className="text-slate-500">No substitutes in pool.</li>}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Volunteers</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {volunteers.map((v) => (
              <li key={v.id as string} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-medium">{v.first_name as string} {v.last_name as string}</p>
                <p className="text-xs capitalize text-slate-500">
                  Background: {String(v.background_check_status).replace(/_/g, " ")} · {v.training_completed ? "Trained" : "Training pending"}
                </p>
              </li>
            ))}
            {!volunteers.length && <li className="text-slate-500">No volunteers registered.</li>}
          </ul>
        </section>
      </div>
    );
  }

  if (view === "positions") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {positions.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-slate-500">No positions yet.</p>
        ) : (
          positions.map((p) => (
            <article key={p.id} className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <h3 className="font-semibold text-slate-900">{p.title}</h3>
              <p className="text-sm text-slate-500">{p.schools?.name}</p>
              {p.department && <p className="mt-1 text-sm text-slate-600">{p.department}</p>}
            </article>
          ))
        )}
      </div>
    );
  }

  if (view === "certifications") {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        {certifications.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No certifications yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Certification</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Expires</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {certifications.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.certification_name}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{(c as { certification_type?: string }).certification_type?.replace(/_/g, " ") ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.expiration_date ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (view === "payroll") {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        {payroll.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No payroll records yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Employee</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Period</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Gross</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Net</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payroll.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">{p.employees?.employee_profiles?.display_name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{p.pay_period_start} – {p.pay_period_end}</td>
                  <td className="px-4 py-3">{formatCurrency(Number(p.gross_pay))}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(Number(p.net_pay))}</td>
                  <td className="px-4 py-3 capitalize">{p.pay_status}</td>
                  <td className="px-4 py-3">
                    {p.pay_status === "pending" && canRunPayroll && (
                      <form action={approvePayrollFormAction}>
                        <input type="hidden" name="payroll_id" value={p.id} />
                        <button type="submit" className="text-xs text-brand-600">Approve & allocate</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (view === "create") {
    return <HrForms employees={employees} schools={schools} positions={positions} />;
  }

  return <EmployeeList employees={employees} />;
}
