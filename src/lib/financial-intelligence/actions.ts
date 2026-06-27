"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canImportFi, canManageFi, canRunScenarios } from "@/lib/financial-intelligence/access";
import { createScenario } from "@/lib/financial-intelligence/scenarios";
import { importCsvFinancialData } from "@/lib/financial-intelligence/csv-import";
import { syncFinancialIntelligence } from "@/lib/financial-intelligence/automation";
import type { QuickBooksImportType } from "@/lib/financial-intelligence/quickbooks-import";
import type { ScenarioInput } from "@/lib/financial-intelligence/types";

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

export async function refreshFinancialIntelligenceAction(formData: FormData): Promise<void> {
  const ctx = await getIdentityContext();
  if (!ctx || !canManageFi(ctx)) return;

  const supabase = await createAuthClient();
  const schoolId = resolveSchoolId(ctx, formData.get("school_id")?.toString());
  await syncFinancialIntelligence(supabase);
  void schoolId;
  revalidatePath("/dashboard/finance/intelligence");
  revalidatePath("/dashboard/executive");
}

export async function runScenarioAction(formData: FormData): Promise<void> {
  const ctx = await getIdentityContext();
  if (!ctx || !canRunScenarios(ctx)) return;

  const supabase = await createAuthClient();
  const schoolId = resolveSchoolId(ctx, formData.get("school_id")?.toString());

  const inputs: ScenarioInput = {
    tuitionChangePct: Number(formData.get("tuition_change_pct") || 0),
    enrollmentChangePct: Number(formData.get("enrollment_change_pct") || 0),
    teacherHires: Number(formData.get("teacher_hires") || 0),
    classesAdded: Number(formData.get("classes_added") || 0),
    classesClosed: Number(formData.get("classes_closed") || 0),
    scholarshipChangePct: Number(formData.get("scholarship_change_pct") || 0),
    salaryIncreasePct: Number(formData.get("salary_increase_pct") || 0),
    facilityExpansionCost: Number(formData.get("facility_expansion_cost") || 0),
  };

  await createScenario(supabase, {
    schoolId,
    name: formData.get("name")?.toString() || "Executive scenario",
    scenarioType: formData.get("scenario_type")?.toString() || "custom",
    inputs,
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/finance/intelligence");
}

export async function importCsvFinancialAction(formData: FormData): Promise<void> {
  const ctx = await getIdentityContext();
  if (!ctx || !canImportFi(ctx)) return;

  const supabase = await createAuthClient();
  const schoolId = resolveSchoolId(ctx, formData.get("school_id")?.toString());
  const csvContent = formData.get("csv_content")?.toString() ?? "";
  const importType = (formData.get("import_type")?.toString() ?? "transactions") as QuickBooksImportType;

  await importCsvFinancialData(supabase, {
    schoolId,
    importType,
    csvContent,
    fileName: formData.get("file_name")?.toString(),
    importedBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/finance/intelligence");
}
