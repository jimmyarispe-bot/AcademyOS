import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewEdi } from "@/lib/edi/access";
import { getRecommendationsByDomain, getTopRecommendations } from "@/lib/edi/recommendation-engine";
import { DecisionCardList, RefreshEdiButton } from "@/components/edi/EdiPanels";

const DOMAINS = [
  { key: "all", label: "All" },
  { key: "class", label: "Class" },
  { key: "program", label: "Program" },
  { key: "teacher", label: "Teacher" },
  { key: "scheduling", label: "Scheduling" },
  { key: "financial", label: "Financial" },
  { key: "enrollment", label: "Enrollment" },
  { key: "student_success", label: "Student Success" },
] as const;

interface PageProps {
  searchParams: Promise<{ domain?: string }>;
}

export default async function ExecutiveRecommendationsPage({ searchParams }: PageProps) {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewEdi(ctx)) return null;

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    "";

  if (!schoolId) return null;

  const { domain: rawDomain } = await searchParams;
  const domain = DOMAINS.find((d) => d.key === rawDomain)?.key ?? "all";

  const supabase = await createAuthClient();
  const recommendations =
    domain === "all"
      ? await getTopRecommendations(supabase, schoolId, 50)
      : await getRecommendationsByDomain(supabase, schoolId, domain);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex flex-wrap gap-2">
          {DOMAINS.map((d) => (
            <a
              key={d.key}
              href={d.key === "all" ? "/dashboard/executive/recommendations" : `/dashboard/executive/recommendations?domain=${d.key}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                domain === d.key ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {d.label}
            </a>
          ))}
        </nav>
        <RefreshEdiButton />
      </div>
      <DecisionCardList cards={recommendations} schoolId={schoolId} />
    </div>
  );
}
