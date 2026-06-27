"use client";

import Link from "next/link";
import { QUICK_LAUNCH_MODULES } from "@/lib/dashboard/navigation";
import { ModuleIcon } from "./ModuleIcons";

export function QuickLaunchGrid() {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Quick Launch</h2>
        <p className="mt-1 text-sm text-slate-500">
          Jump directly into key AcademyOS modules
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {QUICK_LAUNCH_MODULES.map((module) => (
          <Link
            key={module.id}
            href={module.href}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-brand-200 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
              <ModuleIcon moduleId={module.id} className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900">
                {module.id === "executive"
                  ? "Executive Dashboard"
                  : module.pageTitle}
              </h3>
              <p className="mt-1 text-sm text-slate-500">{module.pageSubtitle}</p>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500"
              aria-hidden
            >
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ))}
      </div>
    </section>
  );
}
