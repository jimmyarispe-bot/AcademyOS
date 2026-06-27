"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canManageEdi } from "@/lib/edi/access";
import { recordDecision, rejectRecommendation } from "@/lib/edi/decision-history";
import { createEdiScenario } from "@/lib/edi/scenario-comparison";
import { syncExecutiveDecisionIntelligence } from "@/lib/edi/automation";
import type { EdiScenarioInput } from "@/lib/edi/types";

function resolveSchoolId(ctx: NonNullable<Awaited<ReturnType<typeof getIdentityContext>>>, formSchoolId?: string | null) {
  const schoolId =
    formSchoolId ||
    ctx.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx.accessibleSchoolIds[0];
  if (!schoolId || !ctx.accessibleSchoolIds.includes(schoolId)) {
    throw new Error("Invalid school");
  }
  return schoolId;
}

export async function refreshEdiAction(formData: FormData): Promise<void> {
  const ctx = await getIdentityContext();
  if (!ctx || !canManageEdi(ctx)) return;

  const supabase = await createAuthClient();
  await syncExecutiveDecisionIntelligence(supabase);
  revalidatePath("/dashboard/executive");
}

export async function approveRecommendationAction(formData: FormData): Promise<void> {
  const ctx = await getIdentityContext();
  if (!ctx || !canManageEdi(ctx)) return;

  const supabase = await createAuthClient();
  const schoolId = resolveSchoolId(ctx, formData.get("school_id")?.toString());
  const recommendationId = formData.get("recommendation_id")?.toString() ?? "";

  await recordDecision(supabase, {
    schoolId,
    recommendationId,
    decisionMade: "approved",
    approvedBy: ctx.effectiveUserId,
    reason: formData.get("reason")?.toString(),
    projectedFinancialImpact: Number(formData.get("financial_impact") || 0),
  });

  revalidatePath("/dashboard/executive/decisions");
}

export async function rejectRecommendationAction(formData: FormData): Promise<void> {
  const ctx = await getIdentityContext();
  if (!ctx || !canManageEdi(ctx)) return;

  const supabase = await createAuthClient();
  const schoolId = resolveSchoolId(ctx, formData.get("school_id")?.toString());
  const recommendationId = formData.get("recommendation_id")?.toString() ?? "";

  await rejectRecommendation(supabase, recommendationId, {
    schoolId,
    approvedBy: ctx.effectiveUserId,
    reason: formData.get("reason")?.toString(),
  });

  revalidatePath("/dashboard/executive/decisions");
}

export async function runEdiScenarioAction(formData: FormData): Promise<void> {
  const ctx = await getIdentityContext();
  if (!ctx || !canManageEdi(ctx)) return;

  const supabase = await createAuthClient();
  const schoolId = resolveSchoolId(ctx, formData.get("school_id")?.toString());

  const inputs: EdiScenarioInput = {
    tuitionChangePct: Number(formData.get("tuition_change_pct") || 0),
    enrollmentChangePct: Number(formData.get("enrollment_change_pct") || 0),
    teacherHires: Number(formData.get("teacher_hires") || 0),
    classSizeIncrease: Number(formData.get("class_size_increase") || 0),
    sectionsAdded: Number(formData.get("sections_added") || 0),
    sectionsClosed: Number(formData.get("sections_closed") || 0),
    facilityLeaseCost: Number(formData.get("facility_lease_cost") || 0),
    campusExpansionPct: Number(formData.get("campus_expansion_pct") || 0),
  };

  await createEdiScenario(supabase, {
    schoolId,
    name: formData.get("name")?.toString() || "Custom scenario",
    scenarioType: formData.get("scenario_type")?.toString() || "custom",
    inputs,
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/executive/scenarios");
}
