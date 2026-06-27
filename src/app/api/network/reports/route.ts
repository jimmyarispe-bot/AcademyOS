import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewIntelligenceNetwork } from "@/lib/intelligence-network/access";
import { getResearchReports } from "@/lib/intelligence-network/research-warehouse";
import { getBenchmarks } from "@/lib/intelligence-network/benchmark-engine";

export async function GET() {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewIntelligenceNetwork(ctx)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAuthClient();
  const [benchmarks, research] = await Promise.all([
    getBenchmarks(supabase, {}),
    getResearchReports(supabase),
  ]);

  return NextResponse.json({
    version: "1.0",
    privacy: "opt-in anonymized aggregation only",
    benchmarks: benchmarks.slice(0, 50),
    research: research.map((r) => ({
      key: r.report_key,
      title: r.report_title,
      category: r.report_category,
      peerCount: r.peer_organizations_count,
    })),
  });
}
