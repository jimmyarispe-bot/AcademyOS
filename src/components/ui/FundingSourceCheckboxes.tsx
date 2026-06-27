import { FUNDING_SOURCES } from "@/lib/constants/programs";

interface FundingSourceCheckboxesProps {
  name?: string;
  defaultSelected?: string[];
}

export function FundingSourceCheckboxes({
  name = "funding_sources",
  defaultSelected = [],
}: FundingSourceCheckboxesProps) {
  const selected = new Set(defaultSelected);

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Funding Sources</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {FUNDING_SOURCES.map((source) => (
          <label
            key={source.value}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              name={name}
              value={source.value}
              defaultChecked={selected.has(source.value)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {source.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
