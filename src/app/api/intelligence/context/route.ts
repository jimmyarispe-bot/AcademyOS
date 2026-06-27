import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { buildSecureContext } from "@/lib/intelligence-platform/context-builder";
import { PROVIDER_ADAPTER_ARCHITECTURE } from "@/lib/intelligence-platform/provider-abstraction";
import { FUTURE_AI_USE_CASES } from "@/lib/intelligence-platform/types";

export async function GET() {
  const supabase = await createAuthClient();
  const gate = await guardApiRoute(supabase, "ai.view");
  if (gate instanceof NextResponse) return gate;

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
  const supabase = await createAuthClient();
  const gate = await guardApiRoute(supabase, "ai.use");
  if (gate instanceof NextResponse) return gate;

  const ctx = await getIdentityContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const defaultOrgId = (await getPrimaryOrganizationId(supabase)) ?? "";
  const organizationId =
    typeof body.organizationId === "string" && body.organizationId
      ? body.organizationId
      : defaultOrgId;
  const schoolId =
    typeof body.schoolId === "string" ? body.schoolId : ctx.accessibleSchoolIds[0] ?? undefined;
  const moduleName = typeof body.module === "string" ? body.module : "general";
  const scopes =
    body.scopes && typeof body.scopes === "object"
      ? (body.scopes as { studentIds?: string[]; financialScope?: boolean; executiveScope?: boolean })
      : undefined;

  const result = buildSecureContext({
    organizationId,
    schoolId,
    userId: ctx.effectiveUserId,
    module: moduleName,
    permissions: ctx.permissions,
    scopes,
  });

  return NextResponse.json({
    ...result,
    note: "Context built — no provider invocation (Release 12.5)",
  });
}
