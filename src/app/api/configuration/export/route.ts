import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { exportConfigurationPackage, configurationToJson } from "@/lib/configuration/import-export";
import { getPrimaryOrganizationId } from "@/lib/configuration/context";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  let gate = await guardApiRoute(supabase, "configuration.admin");
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "configuration.manage");
    if (gate instanceof NextResponse) return gate;
  }

  const schoolId = request.nextUrl.searchParams.get("organization_id");
  const orgId = schoolId || (await getPrimaryOrganizationId(supabase));
  if (!orgId) return NextResponse.json({ error: "organization not found" }, { status: 400 });

  const result = await exportConfigurationPackage(supabase, orgId, "full");
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  const json = configurationToJson(result.data);
  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="academyos-config-${date}.json"`,
    },
  });
}
