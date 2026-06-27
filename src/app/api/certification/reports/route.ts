import { NextResponse } from "next/server";
import { E2E_WORKFLOWS, LAUNCH_DOMAINS, READINESS_THRESHOLD, HEALTH_DOMAINS, SCALABILITY_TIERS } from "@/lib/certification/types";

export async function GET() {
  return NextResponse.json({
    name: "AcademyOS Enterprise Certification Center API",
    version: "1.0",
    workflows: E2E_WORKFLOWS.length,
    launchDomains: LAUNCH_DOMAINS.length,
    healthDomains: HEALTH_DOMAINS.length,
    scalabilityTiers: SCALABILITY_TIERS,
    readinessThreshold: READINESS_THRESHOLD,
  });
}
