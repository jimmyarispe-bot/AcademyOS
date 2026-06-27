import { NextResponse } from "next/server";
import { WEBHOOK_EVENT_TYPES, API_VERSIONS, SDK_LANGUAGES, IHUB_AI_CAPABILITIES, EVENT_BUS_MODULES } from "@/lib/integration-hub/types";

export async function GET() {
  return NextResponse.json({
    name: "AcademyOS Enterprise Integration Hub API",
    version: "1.0",
    apiVersions: API_VERSIONS,
    auth: ["oauth2", "openid_connect", "api_key", "jwt", "sandbox"],
    webhookEvents: WEBHOOK_EVENT_TYPES.length,
    eventBusModules: EVENT_BUS_MODULES,
    sdkLanguages: SDK_LANGUAGES.map((s) => s.language),
    aiReadiness: IHUB_AI_CAPABILITIES,
    docs: "/dashboard/integrations/developer",
  });
}
