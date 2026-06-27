import { SETUP_WIZARD_STEPS } from "@/lib/configuration/types";
import { advanceSetupAction } from "@/lib/configuration/actions";
import { getSetupProgress } from "@/lib/configuration/setup-wizard";

interface SetupWizardPanelProps {
  organizationId: string;
  session: {
    id: string;
    current_step: string;
    steps_completed: string[];
    draft_config: Record<string, unknown>;
  } | null;
}

const STEP_FIELDS: Record<string, Array<{ name: string; label: string }>> = {
  organization: [
    { name: "legal_name", label: "Legal name" },
    { name: "tax_id", label: "Tax ID" },
    { name: "website", label: "Website" },
    { name: "mission", label: "Mission" },
    { name: "vision", label: "Vision" },
    { name: "timezone", label: "Time zone" },
  ],
  branding: [
    { name: "primary_color", label: "Primary color" },
    { name: "secondary_color", label: "Secondary color" },
    { name: "accent_color", label: "Accent color" },
    { name: "logo_url", label: "Logo URL" },
  ],
};

export function SetupWizardPanel({ organizationId, session }: SetupWizardPanelProps) {
  const currentStep = session?.current_step ?? "organization";
  const completed = (session?.steps_completed as string[]) ?? [];
  const progress = getSetupProgress(completed);
  const stepMeta = SETUP_WIZARD_STEPS.find((s) => s.key === currentStep);
  const fields = STEP_FIELDS[currentStep] ?? [{ name: "notes", label: "Configuration notes" }];
  const draft = ((session?.draft_config as Record<string, Record<string, unknown>>)?.[currentStep]) ?? {};

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-brand-700">Setup progress</p>
            <p className="text-2xl font-bold text-brand-900">{progress}%</p>
          </div>
          <p className="text-sm text-brand-800">
            Step: <strong>{stepMeta?.label ?? currentStep}</strong>
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100">
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ul className="flex flex-wrap gap-2 text-xs">
        {SETUP_WIZARD_STEPS.map((s) => (
          <li
            key={s.key}
            className={`rounded-full px-2 py-1 ${
              completed.includes(s.key) ? "bg-emerald-100 text-emerald-800" : s.key === currentStep ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"
            }`}
          >
            {s.label}
          </li>
        ))}
      </ul>

      <form action={advanceSetupAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <input type="hidden" name="organization_id" value={organizationId} />
        <input type="hidden" name="step" value={currentStep} />
        <h3 className="font-semibold">{stepMeta?.label ?? currentStep}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.name} className="block text-sm">
              <span className="text-slate-600">{f.label}</span>
              <input
                name={`field_${f.name}`}
                defaultValue={String(draft[f.name] ?? "")}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          ))}
        </div>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Save &amp; continue
        </button>
      </form>
    </div>
  );
}
