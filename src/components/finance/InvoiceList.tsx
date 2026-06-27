import { formatCurrency } from "@/lib/format";
import { FundingSourceBadges } from "@/components/ui/FundingSourceBadges";
import type { Invoice } from "@/lib/finance/queries";



interface InvoiceListProps {

  invoices: Invoice[];

}



export function InvoiceList({ invoices }: InvoiceListProps) {

  if (invoices.length === 0) {

    return <p className="py-8 text-center text-sm text-slate-500">No invoices yet.</p>;

  }



  return (

    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">

      <table className="min-w-full divide-y divide-slate-200">

        <thead className="bg-slate-50">

          <tr>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Invoice</th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Student</th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Funding</th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Family</th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Total</th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Discount</th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Due</th>

            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>

          </tr>

        </thead>

        <tbody className="divide-y divide-slate-100">

          {invoices.map((inv) => {

            const studentName = inv.students

              ? `${inv.students.first_name} ${inv.students.last_name}`

              : "—";

            const fundingCodes = inv.students?.funding_sources ?? [];



            return (

              <tr key={inv.id}>

                <td className="px-4 py-3 text-sm font-medium text-slate-900">{inv.invoice_number}</td>

                <td className="px-4 py-3 text-sm text-slate-600">{studentName}</td>

                <td className="px-4 py-3">

                  <FundingSourceBadges codes={fundingCodes} />

                </td>

                <td className="px-4 py-3 text-sm text-slate-600">

                  {inv.family_billing_accounts?.families?.family_name ?? "—"}

                </td>

                <td className="px-4 py-3 text-sm text-slate-900">{formatCurrency(Number(inv.total_amount))}</td>

                <td className="px-4 py-3 text-sm text-emerald-600">

                  {Number(inv.sibling_discount_amount) > 0

                    ? `-${formatCurrency(Number(inv.sibling_discount_amount))}`

                    : "—"}

                </td>

                <td className="px-4 py-3 text-sm text-slate-500">{inv.due_date}</td>

                <td className="px-4 py-3">

                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-700">

                    {inv.invoice_status}

                  </span>

                </td>

              </tr>

            );

          })}

        </tbody>

      </table>

    </div>

  );

}


