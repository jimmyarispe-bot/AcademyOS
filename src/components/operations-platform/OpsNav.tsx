"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { OPS_NAV } from "@/lib/operations-platform/types";

export function OpsNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="mb-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium lg:hidden" onClick={() => setOpen(!open)}>
        {open ? "Hide menu" : "Operations menu"}
      </button>
      <nav className={`flex flex-wrap gap-2 border-b border-slate-200 pb-3 ${open ? "" : "hidden lg:flex"}`}>
        {OPS_NAV.map((item) => {
          const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function OpsShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">AcademyOS Operations Center</p>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">← School Platform</Link>
      </div>
      <OpsNav />
      {children}
    </div>
  );
}
