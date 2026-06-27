import Link from "next/link";
import { AIP_NAV } from "@/lib/intelligence-platform/types";

export function AipHub() {
  const links = AIP_NAV.filter((l) => l.href !== "/dashboard/intelligence");

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
        >
          <h3 className="font-semibold text-slate-900">{link.label}</h3>
          <p className="mt-1 text-sm text-slate-500">Intelligence platform — {link.label.toLowerCase()}</p>
        </Link>
      ))}
    </div>
  );
}
