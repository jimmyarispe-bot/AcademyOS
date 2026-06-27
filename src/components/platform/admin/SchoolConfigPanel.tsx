"use client";

import Link from "next/link";
import { useTransition } from "react";
import { saveSchoolBrandingAction } from "@/lib/platform/identity/server-actions";

interface SchoolConfigPanelProps {
  schools: Array<{ id: string; name: string }>;
  selectedSchoolId: string;
  branding: {
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
  } | null;
  settingsConfig: Record<string, unknown>;
}

export function SchoolConfigPanel({
  schools,
  selectedSchoolId,
  branding,
  settingsConfig,
}: SchoolConfigPanelProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {schools.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/admin/schools?school=${s.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              s.id === selectedSchoolId
                ? "bg-brand-600 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s.name}
          </Link>
        ))}
      </div>

      <form
        className="grid gap-6 lg:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => {
            void saveSchoolBrandingAction(fd);
          });
        }}
      >
        <input type="hidden" name="school_id" value={selectedSchoolId} />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Branding</h3>
          <label className="block text-sm">
            <span className="text-slate-600">Logo URL</span>
            <input
              name="logo_url"
              defaultValue={branding?.logo_url ?? ""}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(["primary_color", "secondary_color", "accent_color"] as const).map((field) => (
              <label key={field} className="block text-sm">
                <span className="capitalize text-slate-600">{field.replace("_", " ")}</span>
                <input
                  name={field}
                  type="color"
                  defaultValue={branding?.[field] ?? "#4F46E5"}
                  className="mt-1 h-10 w-full rounded-lg border"
                />
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save branding
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Configuration modules</h3>
          <p className="mt-1 text-sm text-slate-500">
            Admissions workflows, document requirements, funding programs, and automation templates
            are configured in their module settings. This panel centralizes branding; module admins
            manage operational config per school.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/dashboard/admissions/checklist" className="text-brand-600 hover:underline">
                Document requirements & checklist
              </Link>
            </li>
            <li>
              <Link href="/dashboard/admissions/workflows" className="text-brand-600 hover:underline">
                Admissions workflows
              </Link>
            </li>
            <li>
              <Link href="/dashboard/admissions/funding-programs" className="text-brand-600 hover:underline">
                Funding programs
              </Link>
            </li>
            <li>
              <Link href="/dashboard/admissions/communications" className="text-brand-600 hover:underline">
                Email & SMS templates
              </Link>
            </li>
          </ul>
          {Object.keys(settingsConfig).length > 0 && (
            <pre className="mt-4 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {JSON.stringify(settingsConfig, null, 2)}
            </pre>
          )}
        </div>
      </form>
    </div>
  );
}
