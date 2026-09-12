import Link from "next/link";
import type { Family } from "@/lib/students/queries";
import { EmailLink } from "@/components/platform/contact/ContactLink";

interface FamilyListProps {
  families: Family[];
}

/** Compact family cards for the Students tab alias — full table lives at /dashboard/families. */
export function FamilyList({ families }: FamilyListProps) {
  if (families.length === 0) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-sm text-slate-500">No families yet.</p>
        <Link href="/dashboard/families" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Open Family Management →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/dashboard/families"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open Family Management →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {families.map((family) => (
          <Link
            key={family.id}
            href={`/dashboard/families/${family.id}?section=overview`}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
          >
            <h3 className="font-semibold text-slate-900">{family.family_name}</h3>
            <p className="mt-1 text-sm text-slate-500">{family.schools?.name}</p>
            {family.primary_address && (
              <p className="mt-2 text-sm text-slate-600">{family.primary_address}</p>
            )}
            {family.billing_email && (
              <p className="mt-1 text-xs">
                <EmailLink email={family.billing_email} />
              </p>
            )}
            <p className="mt-2 text-xs capitalize text-slate-500">{family.status}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
