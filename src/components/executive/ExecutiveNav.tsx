"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const EXECUTIVE_NAV = [
  { href: "/dashboard/executive", label: "Command Center", exact: true },
  { href: "/dashboard/executive/decisions", label: "Decisions" },
  { href: "/dashboard/executive/recommendations", label: "Recommendations" },
  { href: "/dashboard/executive/scenarios", label: "EDI Scenarios" },
  { href: "/dashboard/executive/optimization", label: "Optimization" },
  { href: "/dashboard/executive/capacity", label: "Capacity" },
  { href: "/dashboard/executive/briefings", label: "Briefings" },
  { href: "/dashboard/executive/network", label: "Network" },
  { href: "/dashboard/executive/kpis", label: "KPIs" },
  { href: "/dashboard/executive/forecasting", label: "Forecasting" },
  { href: "/dashboard/executive/risk", label: "Risk" },
  { href: "/dashboard/executive/strategic", label: "Strategic Plan" },
  { href: "/dashboard/executive/compliance", label: "Compliance" },
  { href: "/dashboard/executive/grants", label: "Grants" },
  { href: "/dashboard/executive/benchmarks", label: "Benchmarks" },
  { href: "/dashboard/executive/board", label: "Board Reports" },
  { href: "/dashboard/executive/reports", label: "Report Studio" },
];

export function ExecutiveNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {EXECUTIVE_NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
