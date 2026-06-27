import { fundingSourceLabel } from "@/lib/constants/programs";

interface FundingSourceBadgesProps {
  codes: string[];
  emptyLabel?: string;
}

export function FundingSourceBadges({
  codes,
  emptyLabel = "—",
}: FundingSourceBadgesProps) {
  if (!codes.length) {
    return <span className="text-sm text-slate-500">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((code) => (
        <span
          key={code}
          className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
        >
          {fundingSourceLabel(code)}
        </span>
      ))}
    </div>
  );
}
