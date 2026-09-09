import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency } from "@/lib/format";
import type { NetworkFigures } from "@/lib/financial-intelligence/quickbooks-financials";

/**
 * Every QuickBooks book at once — the consolidated position, and what it is
 * made of.
 *
 * THE HEADLINE NUMBER IS NOT THE SUM OF THE CAMPUSES. To 7 September 2026 the
 * four schools together made $265,876 while the network made −$12,031, because
 * the parent entity spent $309,138 and is not a campus. A "network" tile
 * showing $265,876 would be a quarter of a million dollars of flattery.
 *
 * Hence the table. The total is stated, and immediately beneath it every book
 * that produced it, so the reader can see the parent's deficit rather than take
 * the headline on trust.
 */

const SCOPE_NOTE: Record<string, string> = {
  school: "Campus",
  network: "Parent entity",
  entity: "Legal entity, not a campus",
  unassigned: "Not mapped to anything",
};

export function NetworkOverview({ figures }: { figures: NetworkFigures }) {
  const margin = figures.totalIncome ? (figures.netIncome / figures.totalIncome) * 100 : 0;
  const campuses = figures.books.filter((b) => b.scope === "school");
  const campusNet = campuses.reduce((a, b) => a + b.netIncome, 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Consolidated net"
          value={formatCurrency(figures.netIncome)}
          description={`Every book · ${figures.periodStart} to ${figures.periodEnd}`}
          accent={figures.netIncome < 0 ? "rose" : "emerald"}
          icon={<span className="font-bold">N</span>}
        />
        <StatCard
          title="Income"
          value={formatCurrency(figures.totalIncome)}
          description={`${margin.toFixed(1)}% net margin across ${figures.books.length} books`}
          accent="indigo"
          icon={<span className="font-bold">R</span>}
        />
        <StatCard
          title="Campuses alone"
          value={formatCurrency(campusNet)}
          description={`${campuses.length} schools, before the parent entity`}
          accent="sky"
          icon={<span className="font-bold">C</span>}
        />
        <StatCard
          title="Cash"
          value={figures.cash == null ? "—" : formatCurrency(figures.cash)}
          description="Balance sheet, all books"
          accent="amber"
          icon={<span className="font-bold">$</span>}
        />
      </section>

      {campusNet !== figures.netIncome ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The campuses made <strong>{formatCurrency(campusNet)}</strong>. The network made{" "}
          <strong>{formatCurrency(figures.netIncome)}</strong>. The difference is everything that is
          not a campus — the parent entity and any closed or unmapped book — and it is the reason a
          school-level margin should never be quoted as the business&apos;s margin.
        </p>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Book</th>
              <th className="px-4 py-3">What it is</th>
              <th className="px-4 py-3 text-right">Income</th>
              <th className="px-4 py-3 text-right">Expenses</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-right">Cash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {figures.books.map((b) => (
              <tr key={b.connectionId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{b.company}</td>
                <td className="px-4 py-3 text-slate-500">{SCOPE_NOTE[b.scope] ?? b.scope}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatCurrency(b.totalIncome)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatCurrency(b.totalExpenses)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-medium tabular-nums ${
                    b.netIncome < 0 ? "text-rose-700" : "text-slate-900"
                  }`}
                >
                  {formatCurrency(b.netIncome)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {b.cash == null ? "—" : formatCurrency(b.cash)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50">
            <tr>
              <td className="px-4 py-3 font-semibold text-slate-900" colSpan={2}>
                Consolidated
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatCurrency(figures.totalIncome)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatCurrency(figures.totalExpenses)}
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold tabular-nums ${
                  figures.netIncome < 0 ? "text-rose-700" : "text-slate-900"
                }`}
              >
                {formatCurrency(figures.netIncome)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {figures.cash == null ? "—" : formatCurrency(figures.cash)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p className="text-xs text-slate-500">
        Accrual basis, from the QuickBooks books.
        {figures.booksSkipped > 0
          ? ` ${figures.booksSkipped} row(s) reported a different period and were left out rather than folded into a total that would not be any period at all.`
          : ""}{" "}
        Class, teacher, programme and family analysis is per campus — pick one above.
      </p>
    </div>
  );
}
