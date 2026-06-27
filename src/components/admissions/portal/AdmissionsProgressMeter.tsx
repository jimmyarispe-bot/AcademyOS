import type { AdmissionsProgress } from "@/lib/admissions/portal/progress";

interface AdmissionsProgressMeterProps {
  progress: AdmissionsProgress;
}

export function AdmissionsProgressMeter({ progress }: AdmissionsProgressMeterProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Admissions Progress</h2>
          <p className="text-sm text-slate-500">
            Complete each step to move your application forward.
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-brand-600">{progress.percentComplete}%</p>
          <p className="text-xs uppercase tracking-wider text-slate-400">Complete</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-500"
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>

      <ol className="mt-6 space-y-3">
        {progress.steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.complete
                  ? "bg-emerald-100 text-emerald-700"
                  : step.current
                    ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500/30"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {step.complete ? "✓" : index + 1}
            </span>
            <div>
              <p
                className={`text-sm font-medium ${
                  step.complete ? "text-emerald-800" : step.current ? "text-slate-900" : "text-slate-500"
                }`}
              >
                {step.label}
                {step.optional && (
                  <span className="ml-2 text-xs font-normal text-slate-400">(if applicable)</span>
                )}
              </p>
              {step.current && !step.complete && (
                <p className="text-xs text-brand-600">Current step</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {progress.readyToSubmit && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          All required items are complete. You may submit your application for review.
        </p>
      )}
    </div>
  );
}
