import type {
  ClassProfitabilityRow,
  TeacherProfitabilityRow,
  ProgramProfitabilityRow,
  StudentEconomicsRow,
  FamilyAnalyticsRow,
  ExecutiveFinancialDashboard,
  ScenarioResult,
} from "@/lib/financial-intelligence/types";
import { formatCurrency } from "@/lib/format";
import {
  refreshFinancialIntelligenceAction,
  runScenarioAction,
  importCsvFinancialAction,
} from "@/lib/financial-intelligence/actions";

function HealthBadge({ health }: { health: string }) {
  const cls =
    health === "green"
      ? "bg-emerald-50 text-emerald-700"
      : health === "yellow"
        ? "bg-amber-50 text-amber-800"
        : "bg-rose-50 text-rose-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>{health}</span>;
}

export function FiExecutiveOverview({ dashboard }: { dashboard: ExecutiveFinancialDashboard }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="EBITDA" value={formatCurrency(dashboard.ebitda)} />
        <Metric label="Cash position" value={formatCurrency(dashboard.cashPosition)} />
        <Metric label="Operating margin" value={`${dashboard.operatingMargin.toFixed(1)}%`} />
        <Metric label="Contribution margin" value={`${dashboard.contributionMargin.toFixed(1)}%`} />
        <Metric label="Classes below break-even" value={dashboard.classesBelowBreakeven} />
        <Metric label="Classes above target" value={dashboard.classesAboveTarget} />
        <Metric label="Financial risks" value={dashboard.financialRisks} />
        <Metric
          label="Revenue forecast"
          value={dashboard.forecastRevenue != null ? formatCurrency(dashboard.forecastRevenue) : "—"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProgramList title="Top performing programs" programs={dashboard.topPrograms} />
        <ProgramList title="Lowest performing programs" programs={dashboard.bottomPrograms} />
      </div>

      <form action={refreshFinancialIntelligenceAction}>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Refresh financial intelligence
        </button>
      </form>
    </div>
  );
}

export function ClassProfitabilityTable({ rows }: { rows: ClassProfitabilityRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Section</th>
            <th className="px-4 py-3">Revenue</th>
            <th className="px-4 py-3">Cost</th>
            <th className="px-4 py-3">Net margin</th>
            <th className="px-4 py-3">Margin %</th>
            <th className="px-4 py-3">Enrollment</th>
            <th className="px-4 py-3">Break-even</th>
            <th className="px-4 py-3">$/seat</th>
            <th className="px-4 py-3">Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.courseSectionId} className="border-b border-slate-50">
              <td className="px-4 py-3 font-medium">{r.sectionCode}</td>
              <td className="px-4 py-3">{formatCurrency(r.revenue)}</td>
              <td className="px-4 py-3">{formatCurrency(r.totalCost)}</td>
              <td className="px-4 py-3">{formatCurrency(r.netMargin)}</td>
              <td className="px-4 py-3">{r.marginPct.toFixed(1)}%</td>
              <td className="px-4 py-3">{r.currentEnrollment}/{r.availableSeats + r.currentEnrollment}</td>
              <td className="px-4 py-3">{r.breakEvenEnrollment}</td>
              <td className="px-4 py-3">{formatCurrency(r.revenuePerSeat)}</td>
              <td className="px-4 py-3"><HealthBadge health={r.healthIndicator} /></td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No class profitability data yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TeacherProfitabilityTable({ rows }: { rows: TeacherProfitabilityRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Teacher</th>
            <th className="px-4 py-3">Revenue</th>
            <th className="px-4 py-3">Classes</th>
            <th className="px-4 py-3">Students</th>
            <th className="px-4 py-3">Hours</th>
            <th className="px-4 py-3">Rev/hr</th>
            <th className="px-4 py-3">Cost/hr</th>
            <th className="px-4 py-3">Net margin</th>
            <th className="px-4 py-3">Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employeeId} className="border-b border-slate-50">
              <td className="px-4 py-3 font-medium">{r.employeeName ?? r.employeeId}</td>
              <td className="px-4 py-3">{formatCurrency(r.revenueGenerated)}</td>
              <td className="px-4 py-3">{r.classesTaught}</td>
              <td className="px-4 py-3">{r.studentsServed}</td>
              <td className="px-4 py-3">{r.instructionalHours.toFixed(1)}</td>
              <td className="px-4 py-3">{formatCurrency(r.revenuePerHour)}</td>
              <td className="px-4 py-3">{formatCurrency(r.costPerHour)}</td>
              <td className="px-4 py-3">{formatCurrency(r.netMargin)}</td>
              <td className="px-4 py-3"><HealthBadge health={r.healthIndicator} /></td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No teacher profitability data yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ProgramProfitabilityTable({ rows }: { rows: ProgramProfitabilityRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Program</th>
            <th className="px-4 py-3">Revenue</th>
            <th className="px-4 py-3">Expenses</th>
            <th className="px-4 py-3">Scholarships</th>
            <th className="px-4 py-3">State funding</th>
            <th className="px-4 py-3">Net margin</th>
            <th className="px-4 py-3">EBITDA</th>
            <th className="px-4 py-3">Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.program} className="border-b border-slate-50">
              <td className="px-4 py-3 font-medium">{r.program}</td>
              <td className="px-4 py-3">{formatCurrency(r.revenue)}</td>
              <td className="px-4 py-3">{formatCurrency(r.expenses)}</td>
              <td className="px-4 py-3">{formatCurrency(r.scholarships)}</td>
              <td className="px-4 py-3">{formatCurrency(r.stateFunding)}</td>
              <td className="px-4 py-3">{formatCurrency(r.netMargin)}</td>
              <td className="px-4 py-3">{formatCurrency(r.ebitdaContribution)}</td>
              <td className="px-4 py-3"><HealthBadge health={r.healthIndicator} /></td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-500">No program data yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function StudentEconomicsTable({ rows }: { rows: StudentEconomicsRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Tuition</th>
            <th className="px-4 py-3">Aid</th>
            <th className="px-4 py-3">ESA</th>
            <th className="px-4 py-3">Revenue</th>
            <th className="px-4 py-3">Allocated cost</th>
            <th className="px-4 py-3">Profitability</th>
            <th className="px-4 py-3">LTV</th>
            <th className="px-4 py-3">Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.studentId} className="border-b border-slate-50">
              <td className="px-4 py-3 font-medium">{r.studentName ?? r.studentId}</td>
              <td className="px-4 py-3">{formatCurrency(r.tuition)}</td>
              <td className="px-4 py-3">{formatCurrency(r.scholarships)}</td>
              <td className="px-4 py-3">{formatCurrency(r.esa)}</td>
              <td className="px-4 py-3">{formatCurrency(r.totalRevenue)}</td>
              <td className="px-4 py-3">{formatCurrency(r.allocatedCosts)}</td>
              <td className="px-4 py-3">{formatCurrency(r.profitability)}</td>
              <td className="px-4 py-3">{formatCurrency(r.lifetimeValue)}</td>
              <td className="px-4 py-3"><HealthBadge health={r.healthIndicator} /></td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No student economics data yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function FamilyAnalyticsTable({ rows }: { rows: FamilyAnalyticsRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Family</th>
            <th className="px-4 py-3">Lifetime revenue</th>
            <th className="px-4 py-3">Outstanding</th>
            <th className="px-4 py-3">Aid received</th>
            <th className="px-4 py-3">Reliability</th>
            <th className="px-4 py-3">Avg monthly</th>
            <th className="px-4 py-3">Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.familyId} className="border-b border-slate-50">
              <td className="px-4 py-3 font-medium">{r.familyId.slice(0, 8)}…</td>
              <td className="px-4 py-3">{formatCurrency(r.lifetimeRevenue)}</td>
              <td className="px-4 py-3">{formatCurrency(r.outstandingBalance)}</td>
              <td className="px-4 py-3">{formatCurrency(r.aidReceived)}</td>
              <td className="px-4 py-3">{r.paymentReliability}%</td>
              <td className="px-4 py-3">{formatCurrency(r.avgMonthlyRevenue)}</td>
              <td className="px-4 py-3"><HealthBadge health={r.collectionRisk} /></td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No family analytics yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ScenarioPanel({
  scenarios,
  latestResult,
  schoolId,
}: {
  scenarios: Array<{ id: string; name: string; scenario_type: string; status: string }>;
  latestResult?: ScenarioResult | null;
  schoolId: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={runScenarioAction} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Scenario modeling</h3>
        <input type="hidden" name="school_id" value={schoolId} />
        <label className="block text-sm">
          <span className="text-slate-600">Scenario name</span>
          <input name="name" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="Tuition +5%, enrollment +10%" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField name="tuition_change_pct" label="Tuition change %" />
          <NumberField name="enrollment_change_pct" label="Enrollment change %" />
          <NumberField name="teacher_hires" label="Teacher hires" />
          <NumberField name="classes_added" label="Classes added" />
          <NumberField name="classes_closed" label="Classes closed" />
          <NumberField name="scholarship_change_pct" label="Scholarship change %" />
          <NumberField name="salary_increase_pct" label="Salary increase %" />
          <NumberField name="facility_expansion_cost" label="Facility expansion $" />
        </div>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Run scenario
        </button>
      </form>

      <div className="space-y-4">
        {latestResult && (
          <article className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-sm">
            <h3 className="font-semibold text-brand-900">Latest projection</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Metric label="Projected revenue" value={formatCurrency(latestResult.projectedRevenue)} />
              <Metric label="Projected EBITDA" value={formatCurrency(latestResult.projectedEbitda)} />
              <Metric label="Δ Revenue" value={formatCurrency(latestResult.deltaRevenue)} />
              <Metric label="Δ EBITDA" value={formatCurrency(latestResult.deltaEbitda)} />
              <Metric label="Margin %" value={`${latestResult.projectedMarginPct.toFixed(1)}%`} />
              <Metric label="Cash flow" value={formatCurrency(latestResult.projectedCashFlow)} />
            </div>
          </article>
        )}
        <ul className="space-y-2">
          {scenarios.map((s) => (
            <li key={s.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{s.name}</span>
                <span className="capitalize text-slate-500">{s.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{s.scenario_type.replace(/_/g, " ")}</p>
            </li>
          ))}
          {!scenarios.length && <li className="text-sm text-slate-500">No saved scenarios yet.</li>}
        </ul>
      </div>
    </div>
  );
}

export function ImportPanel({ schoolId }: { schoolId: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={importCsvFinancialAction} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">CSV / QuickBooks import</h3>
        <p className="text-sm text-slate-500">
          Imported data maps into Financial Intelligence without replacing operational billing records. Source tracking and reconciliation are preserved.
        </p>
        <input type="hidden" name="school_id" value={schoolId} />
        <label className="block text-sm">
          <span className="text-slate-600">Import type</span>
          <select name="import_type" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
            <option value="chart_of_accounts">Chart of Accounts</option>
            <option value="general_ledger">General Ledger</option>
            <option value="transactions">Transactions</option>
            <option value="profit_loss">Profit &amp; Loss</option>
            <option value="balance_sheet">Balance Sheet</option>
            <option value="payroll_summary">Payroll Summary</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">CSV content</span>
          <textarea
            name="csv_content"
            rows={8}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            placeholder="date,account,amount,description"
          />
        </label>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Import CSV
        </button>
      </form>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-900">QuickBooks integration framework</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>CSV, Excel, IIF, and QBO export formats supported via import batches</li>
          <li>Chart of accounts, GL, journal entries, P&amp;L, balance sheet, cash flow, budgets</li>
          <li>Payroll summaries, vendors, customers, classes, locations, transactions</li>
          <li>Future direct API sync architecture prepared — no operational record replacement</li>
        </ul>
      </article>
    </div>
  );
}

export function ExecutiveFinancialPanel({ dashboard }: { dashboard: ExecutiveFinancialDashboard }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Financial Intelligence</h2>
        <a href="/dashboard/finance/intelligence" className="text-sm text-brand-600 hover:underline">
          Full dashboard →
        </a>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="EBITDA" value={formatCurrency(dashboard.ebitda)} />
        <Metric label="Operating margin" value={`${dashboard.operatingMargin.toFixed(1)}%`} />
        <Metric label="Below break-even" value={dashboard.classesBelowBreakeven} />
        <Metric label="Active risks" value={dashboard.financialRisks} />
      </div>
    </section>
  );
}

function ProgramList({ title, programs }: { title: string; programs: ProgramProfitabilityRow[] }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {programs.map((p) => (
          <li key={p.program} className="flex items-center justify-between gap-2">
            <span>{p.program}</span>
            <span className="font-medium">{formatCurrency(p.netMargin)}</span>
          </li>
        ))}
        {!programs.length && <li className="text-slate-500">No program data</li>}
      </ul>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function NumberField({ name, label }: { name: string; label: string }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <input name={name} type="number" step="any" defaultValue={0} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
    </label>
  );
}
