import { NextResponse } from "next/server";
import { buildSecureContext } from "@/lib/intelligence-platform/context-builder";
import { PROVIDER_ADAPTER_ARCHITECTURE } from "@/lib/intelligence-platform/provider-abstraction";
import { FUTURE_AI_USE_CASES } from "@/lib/intelligence-platform/types";

export async function GET() {
  return NextResponse.json({
    name: "AcademyOS Enterprise Intelligence & AI Readiness Framework",
    version: "12.5",
    implementation: "architecture_only",
    providers: PROVIDER_ADAPTER_ARCHITECTURE,
    futureUseCases: FUTURE_AI_USE_CASES,
    endpoints: {
      context: "POST /api/intelligence/context",
      docs: "GET /api/intelligence/docs",
    },
    note: "No AI provider calls are made in this release. All modules must route through this platform.",
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const result = buildSecureContext({
    organizationId: body.organizationId ?? "",
    schoolId: body.schoolId,
    userId: body.userId ?? "",
    module: body.module ?? "general",
    permissions: body.permissions ?? [],
    scopes: body.scopes,
  });

  return NextResponse.json({
    ...result,
    note: "Context built — no provider invocation (Release 12.5)",
  });
}
