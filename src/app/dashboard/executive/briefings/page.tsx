import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewEdi, canAccessEdiBoard } from "@/lib/edi/access";
import { getLatestBriefings } from "@/lib/edi/briefings";
import { getLatestScorecard } from "@/lib/edi/scorecard";
import { BriefingList, ExecutiveScorecardPanel } from "@/components/edi/EdiPanels";
import Link from "next/link";

export default async function ExecutiveBriefingsPage() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewEdi(ctx)) return null;

  const schoolId =
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0] ||
    "";

  if (!schoolId) return null;

  const supabase = await createAuthClient();
  const [briefings, scorecard] = await Promise.all([
    getLatestBriefings(supabase, schoolId),
    getLatestScorecard(supabase, schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          Executive briefings — top risks, opportunities, ROI programs, and board summaries.
        </p>
        {canAccessEdiBoard(ctx) && (
          <Link href={`/api/edi/board-report?school_id=${schoolId}`} className="text-sm text-brand-600 hover:underline">
            Export board report CSV →
          </Link>
        )}
      </div>
      <ExecutiveScorecardPanel scorecard={scorecard} />
      <BriefingList briefings={briefings} />
    </div>
  );
}
