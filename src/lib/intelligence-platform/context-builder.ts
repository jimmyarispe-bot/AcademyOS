import type { ContextBuildInput, ContextBuildResult } from "@/lib/intelligence-platform/types";

const SENSITIVE_FIELDS = ["ssn", "medical", "iep", "discipline", "financial_account", "password"];
const FERPA_PERMISSIONS = ["ferpa.view_iep", "ferpa.view_medical", "ferpa.view_discipline", "ferpa.view_evaluations"];

/** Central context builder — all future AI requests route through this service */
export function buildSecureContext(input: ContextBuildInput): ContextBuildResult {
  const maskedFields: string[] = [];
  const contextPayload: Record<string, unknown> = {
    organizationId: input.organizationId,
    schoolId: input.schoolId ?? null,
    module: input.module,
    timestamp: new Date().toISOString(),
  };

  if (input.scopes?.studentIds?.length) {
    contextPayload.studentScope = input.scopes.studentIds;
  }

  if (input.scopes?.financialScope && !input.permissions.includes("ai.finance") && !input.permissions.includes("ai.admin")) {
    maskedFields.push("financial_data");
    contextPayload.financialScope = "masked";
  } else if (input.scopes?.financialScope) {
    contextPayload.financialScope = "allowed";
  }

  if (input.scopes?.executiveScope && !input.permissions.includes("ai.executive") && !input.permissions.includes("ai.admin")) {
    maskedFields.push("executive_data");
    contextPayload.executiveScope = "masked";
  } else if (input.scopes?.executiveScope) {
    contextPayload.executiveScope = "allowed";
  }

  for (const field of SENSITIVE_FIELDS) {
    const permNeeded = FERPA_PERMISSIONS.find((p) => p.includes(field.split("_")[0]));
    if (permNeeded && !input.permissions.includes(permNeeded) && !input.permissions.includes("ai.admin")) {
      maskedFields.push(field);
    }
  }

  const ferpaFiltered = maskedFields.some((f) => ["iep", "medical", "discipline"].some((s) => f.includes(s)));
  const classificationFiltered = maskedFields.length > 0;

  return {
    allowed: input.permissions.includes("ai.use") || input.permissions.includes("ai.admin"),
    maskedFields,
    contextPayload,
    ferpaFiltered,
    classificationFiltered,
  };
}

export function maskSensitiveData(data: Record<string, unknown>, maskedFields: string[]): Record<string, unknown> {
  const result = { ...data };
  for (const key of Object.keys(result)) {
    if (maskedFields.some((f) => key.toLowerCase().includes(f))) {
      result[key] = "[REDACTED]";
    }
  }
  return result;
}
