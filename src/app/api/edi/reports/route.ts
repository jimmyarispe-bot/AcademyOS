import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { buildCsvExport, recommendationsToRows } from "@/lib/edi/reporting";
import { getTopRecommendations, getRecommendationsByDomain } from "@/lib/edi/recommendation-engine";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  let gate = await guardApiRoute(supabase, "edi.view");
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "edi.executive");
    if (gate instanceof NextResponse) {
      gate = await guardApiRoute(supabase, "executive.intelligence");
      if (gate instanceof NextResponse) return gate;
    }
  }

  const url = request.nextUrl;
  const schoolId = url.searchParams.get("school_id") ?? undefined;
  const domain = url.searchParams.get("domain") ?? undefined;

  if (!schoolId) {
    return NextResponse.json({ error: "school_id required" }, { status: 400 });
  }

  const date = new Date().toISOString().split("T")[0];
  const cards = domain
    ? await getRecommendationsByDomain(supabase, schoolId, domain)
    : await getTopRecommendations(supabase, schoolId, 200);

  const rows = recommendationsToRows(cards);
  const csv = buildCsvExport(rows, Object.keys(rows[0] ?? { domain: "" }));

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="edi-recommendations-${date}.csv"`,
    },
  });
}
