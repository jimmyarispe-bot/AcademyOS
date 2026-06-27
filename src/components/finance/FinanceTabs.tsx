import Link from "next/link";
import { InvoiceList } from "./InvoiceList";
import { PaymentList } from "./PaymentList";
import { BillingForms } from "./BillingForms";
import { formatCurrency } from "@/lib/format";
import type {
  BillingAccount,
  Invoice,
  Payment,
  TuitionPlan,
} from "@/lib/finance/queries";

interface FinanceTabsProps {
  view: string;
  invoices: Invoice[];
  payments: Payment[];
  plans: TuitionPlan[];
  accounts: BillingAccount[];
  families: { id: string; family_name: string; school_id: string }[];
  students: { id: string; first_name: string; last_name: string; family_id: string | null }[];
  schools: { id: string; name: string }[];
  forecast: {
    snapshot_name: string;
    forecast_tuition: number;
    actual_tuition: number;
    forecast_scholarships: number;
    actual_scholarships: number;
    forecast_state_funding: number;
    actual_state_funding: number;
    forecast_payroll: number;
    actual_payroll: number;
    enrollment_count: number;
  } | null;
  overdueCount: number;
}

export function FinanceTabs({
  view,
  invoices,
  payments,
  plans,
  accounts,
  families,
  students,
  schools,
  forecast,
  overdueCount,
}: FinanceTabsProps) {
  if (view === "payments") {
    return <PaymentList payments={payments} />;
  }

  if (view === "families") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {families.map((f) => {
          const account = accounts.find((a) => a.family_id === f.id);
          return (
            <Link
              key={f.id}
              href={`/dashboard/finance/families/${f.id}`}
              className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 hover:bg-brand-50"
            >
              <h3 className="font-medium text-slate-900">{f.family_name}</h3>
              <p className="mt-1 text-sm text-slate-600">
                Balance: {formatCurrency(Number(account?.balance ?? 0))}
                {account?.collections_status && account.collections_status !== "current" && (
                  <span className="ml-2 capitalize text-amber-700">{account.collections_status}</span>
                )}
              </p>
            </Link>
          );
        })}
        {!families.length && <p className="text-sm text-slate-500">No families on file.</p>}
      </div>
    );
  }

  if (view === "forecast") {
    return (
      <div className="space-y-6">
        {forecast ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold">{forecast.snapshot_name}</h3>
            <p className="mt-1 text-sm text-slate-500">{forecast.enrollment_count} enrolled students</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-slate-500">Tuition</p>
                <p className="font-medium">Forecast {formatCurrency(Number(forecast.forecast_tuition))}</p>
                <p className="text-slate-600">Actual {formatCurrency(Number(forecast.actual_tuition))}</p>
              </div>
              <div>
                <p className="text-slate-500">Scholarships</p>
                <p className="font-medium">Forecast {formatCurrency(Number(forecast.forecast_scholarships))}</p>
                <p className="text-slate-600">Actual {formatCurrency(Number(forecast.actual_scholarships))}</p>
              </div>
              <div>
                <p className="text-slate-500">State funding</p>
                <p className="font-medium">Forecast {formatCurrency(Number(forecast.forecast_state_funding))}</p>
                <p className="text-slate-600">Actual {formatCurrency(Number(forecast.actual_state_funding))}</p>
              </div>
              <div>
                <p className="text-slate-500">Payroll</p>
                <p className="font-medium">Forecast {formatCurrency(Number(forecast.forecast_payroll))}</p>
                <p className="text-slate-600">Actual {formatCurrency(Number(forecast.actual_payroll))}</p>
              </div>
            </div>
          </article>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            No forecast snapshot yet. Build one from the Create tab or finance actions.
          </p>
        )}
        {overdueCount > 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {overdueCount} overdue invoice(s) — alerts sync to Mission Control via the automation queue.
          </p>
        )}
      </div>
    );
  }

  if (view === "plans") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-slate-500">No tuition plans yet.</p>
        ) : (
          plans.map((plan) => (
            <article key={plan.id} className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <h3 className="font-semibold text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-2xl font-semibold text-brand-600">
                ${Number(plan.annual_amount).toLocaleString()}
              </p>
              <p className="mt-1 text-sm capitalize text-slate-500">{plan.payment_schedule}</p>
            </article>
          ))
        )}
      </div>
    );
  }

  if (view === "accounts") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {accounts.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-slate-500">No billing accounts yet.</p>
        ) : (
          accounts.map((a) => (
            <Link key={a.id} href={`/dashboard/finance/families/${a.family_id}`} className="rounded-2xl border border-slate-200/80 bg-white p-5 hover:border-brand-200">
              <h3 className="font-semibold text-slate-900">{a.families?.family_name ?? "Account"}</h3>
              <p className="mt-1 text-sm text-slate-500">Balance: ${Number(a.balance).toLocaleString()}</p>
              {a.sibling_discount_student_id && (
                <p className="mt-1 text-xs text-emerald-600">{Number(a.sibling_discount_percent)}% sibling discount applied</p>
              )}
            </Link>
          ))
        )}
      </div>
    );
  }

  if (view === "create") {
    return (
      <BillingForms
        families={families}
        students={students}
        schools={schools}
        plans={plans}
        accounts={accounts}
      />
    );
  }

  return <InvoiceList invoices={invoices} />;
}
