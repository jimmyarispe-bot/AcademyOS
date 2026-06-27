import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { globalSearch } from "@/lib/platform/identity/search";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  const gate = await guardApiRoute(supabase, "search.global");
  if (gate instanceof NextResponse) return gate;

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = await globalSearch(supabase, q);

  return NextResponse.json({ results });
}
