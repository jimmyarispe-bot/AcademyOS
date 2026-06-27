import { NextResponse } from "next/server";
import { API_PLATFORM_ARCHITECTURE } from "@/lib/enterprise-data/api-services";
import { EDP_AI_CAPABILITIES } from "@/lib/enterprise-data/types";

export async function GET() {
  return NextResponse.json({
    name: "AcademyOS Enterprise Data Platform API",
    version: API_PLATFORM_ARCHITECTURE.versioning,
    auth: API_PLATFORM_ARCHITECTURE.authMethods,
    scopes: API_PLATFORM_ARCHITECTURE.scopes,
    endpoints: {
      import: "POST /api/data/import",
      export: "GET /api/data/export?type=students&format=csv",
    },
    aiReadiness: EDP_AI_CAPABILITIES,
  });
}
