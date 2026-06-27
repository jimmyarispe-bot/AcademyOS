import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  accent: "indigo" | "emerald" | "amber" | "sky" | "violet" | "rose";
}

const accentStyles = {
  indigo: {
    icon: "bg-indigo-50 text-indigo-600",
    bar: "bg-indigo-500",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600",
    bar: "bg-emerald-500",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600",
    bar: "bg-amber-500",
  },
  sky: {
    icon: "bg-sky-50 text-sky-600",
    bar: "bg-sky-500",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600",
    bar: "bg-violet-500",
  },
  rose: {
    icon: "bg-rose-50 text-rose-600",
    bar: "bg-rose-500",
  },
};

export function StatCard({
  title,
  value,
  description,
  icon,
  accent,
}: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div
        className={`absolute inset-x-0 top-0 h-1 ${styles.bar} opacity-80`}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}
