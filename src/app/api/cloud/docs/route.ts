import { NextResponse } from "next/server";
import { CLOUD_AI_READINESS, CLOUD_EMPLOYEE_ROLES } from "@/lib/cloud-platform/types";

export async function GET() {
  return NextResponse.json({
    name: "AcademyOS Cloud Platform API",
    version: "13.0",
    applications: ["AcademyOS Platform (schools)", "AcademyOS Cloud Console (employees)"],
    employeeRoles: CLOUD_EMPLOYEE_ROLES,
    aiReadiness: CLOUD_AI_READINESS,
    tenantIsolation: "complete",
  });
}
