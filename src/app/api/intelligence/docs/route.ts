import { NextResponse } from "next/server";
import { PROVIDER_ADAPTER_ARCHITECTURE } from "@/lib/intelligence-platform/provider-abstraction";
import { FUTURE_AI_USE_CASES, PROVIDER_CAPABILITIES } from "@/lib/intelligence-platform/types";

export async function GET() {
  return NextResponse.json({
    name: "AcademyOS Intelligence Platform API",
    version: "12.5",
    architecture: "ai_readiness_only",
    providerCapabilities: PROVIDER_CAPABILITIES,
    providers: PROVIDER_ADAPTER_ARCHITECTURE,
    futureUseCases: FUTURE_AI_USE_CASES,
    routes: {
      contextBuilder: "POST /api/intelligence/context",
    },
  });
}
