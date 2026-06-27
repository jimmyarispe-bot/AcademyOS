import Link from "next/link";

export interface ViewTabItem {
  href: string;
  label: string;
  value: string;
}

interface ViewTabsProps {
  tabs: ViewTabItem[];
  activeView: string;
}

export function ViewTabs({ tabs, activeView }: ViewTabsProps) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-slate-50 p-1">
      {tabs.map((tab) => {
        const active = activeView === tab.value;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-white text-brand-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
