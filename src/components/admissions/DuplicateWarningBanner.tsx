import Link from "next/link";
import type { DuplicateMatch } from "@/lib/admissions/duplicates";

interface DuplicateWarningBannerProps {
  matches: DuplicateMatch[];
}

export function DuplicateWarningBanner({ matches }: DuplicateWarningBannerProps) {
  if (matches.length === 0) return null;

  const unique = matches.reduce<Map<string, DuplicateMatch>>((acc, m) => {
    acc.set(`${m.entity_type}-${m.entity_id}`, m);
    return acc;
  }, new Map());

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-900">
        Possible duplicate records detected ({unique.size})
      </h3>
      <ul className="mt-2 space-y-1 text-sm text-amber-800">
        {[...unique.values()].map((m) => (
          <li key={`${m.entity_type}-${m.entity_id}`}>
            <span className="font-medium capitalize">{m.match_type.replace(/_/g, " ")}</span>
            {" — "}
            {m.display_name}
            {m.entity_type === "admissions_lead" && (
              <>
                {" "}
                <Link
                  href={`/dashboard/admissions/leads/${m.entity_id}`}
                  className="underline hover:text-amber-900"
                >
                  View lead
                </Link>
              </>
            )}
            <span className="block text-xs text-amber-700">{m.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
