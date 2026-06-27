import { formatCurrency } from "@/lib/format";
import type { Payment } from "@/lib/finance/queries";

interface PaymentListProps {
  payments: Payment[];
}

export function PaymentList({ payments }: PaymentListProps) {
  if (payments.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No payments recorded.</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Amount</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Method</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Reference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 text-sm text-slate-600">
                {new Date(p.paid_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-emerald-700">
                {formatCurrency(Number(p.amount))}
              </td>
              <td className="px-4 py-3 text-sm capitalize text-slate-600">
                {p.payment_method.replace("_", " ")}
              </td>
              <td className="px-4 py-3 text-sm text-slate-500">{p.reference_number ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
