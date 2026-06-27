import Link from "next/link";
import type { DashboardModule } from "@/lib/dashboard/navigation";
import { ModuleIcon } from "./ModuleIcons";

interface ModulePlaceholderProps {
  module: DashboardModule;
}

export function ModulePlaceholder({ module }: ModulePlaceholderProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-brand-50 px-6 py-8 sm:px-8">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
              <ModuleIcon moduleId={module.id} className="h-7 w-7" />
            </div>
            <div>
              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200/80">
                Coming soon
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                {module.placeholderTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
                {module.placeholderDescription}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Planned capabilities
          </h3>
          <ul className="mt-4 space-y-3">
            {module.placeholderFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-sm text-slate-700"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
                    <path
                      d="M5 12l4 4L19 6"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Back to Executive Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
