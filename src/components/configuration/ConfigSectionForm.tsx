import type { ConfigSectionKey } from "@/lib/configuration/types";
import { saveConfigFieldsAction } from "@/lib/configuration/actions";

interface ConfigField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "color";
  placeholder?: string;
}

export function ConfigSectionForm({
  sectionKey,
  organizationId,
  title,
  description,
  fields,
  config,
}: {
  sectionKey: ConfigSectionKey;
  organizationId: string;
  title: string;
  description?: string;
  fields: ConfigField[];
  config: Record<string, unknown>;
}) {
  return (
    <form action={saveConfigFieldsAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="section_key" value={sectionKey} />
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name} className="block text-sm sm:col-span-2">
            <span className="text-slate-600">{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                name={`field_${field.name}`}
                defaultValue={String(config[field.name] ?? "")}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder={field.placeholder}
              />
            ) : (
              <input
                name={`field_${field.name}`}
                type={field.type ?? "text"}
                defaultValue={String(config[field.name] ?? "")}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder={field.placeholder}
              />
            )}
          </label>
        ))}
      </div>
      <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Save configuration
      </button>
    </form>
  );
}

export function ConfigJsonPreview({ config }: { config: Record<string, unknown> }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
      {JSON.stringify(config, null, 2)}
    </pre>
  );
}
