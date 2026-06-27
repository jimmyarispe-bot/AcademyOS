import {
  fundingSourceCategoryLabel,
  fundingSourceLabel,
} from "@/lib/constants/programs";

interface FundingBreakdownProps {
  byFunding: Record<string, number>;
  byCategory?: Record<string, number>;
  title?: string;
}

function BreakdownList({
  title,
  entries,
  labelForKey,
}: {
  title: string;
  entries: [string, number][];
  labelForKey: (key: string) => string;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h4>
      <ul className="mt-3 space-y-2">
        {entries.map(([key, count]) => (
          <li key={key} className="flex justify-between text-sm">
            <span className="text-slate-600">{labelForKey(key)}</span>
            <span className="font-medium text-slate-900">{count}</span>
          </li>
        ))}
        {entries.length === 0 && <li className="text-sm text-slate-400">No data</li>}
      </ul>
    </div>
  );
}

export function FundingBreakdown({
  title = "Funding Report",
  byFunding,
  byCategory,
}: FundingBreakdownProps) {
  const fundingEntries = Object.entries(byFunding).sort(([, a], [, b]) => b - a);
  const categoryEntries = byCategory
    ? Object.entries(byCategory).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className={`mt-4 grid gap-6 ${byCategory ? "sm:grid-cols-2" : ""}`}>
        {byCategory && (
          <BreakdownList
            title="By Category"
            entries={categoryEntries}
            labelForKey={(key) => fundingSourceCategoryLabel(key)}
          />
        )}
        <BreakdownList
          title="By Funding Source"
          entries={fundingEntries}
          labelForKey={(key) =>
            key === "unassigned" ? "Unassigned" : fundingSourceLabel(key)
          }
        />
      </div>
    </div>
  );
}
