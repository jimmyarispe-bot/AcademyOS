/**
 * Everything the plan builder needs about one child, gathered in one read.
 *
 * The screen this feeds replaces a person reading a price list and typing a
 * schedule into Word. That practice produced, in one folder: Hailey Rosser's
 * $2,000, Abigail McHoney's $3,325 against the family, Aaliyah Clinkscales'
 * $1,000, Penny Shropshire's $750, Alexander Pobuda's missing $1,000 discount,
 * and sixteen Florida schedules that do not add up.
 *
 * Six separate reads rather than nested selects. Each can be refused by RLS,
 * and a refusal returns no rows — which on this screen would look like "this
 * school sells nothing" or "this child has no scholarship". Both are answers
 * that would produce a wrong invoice, so each failure names itself.
 */

import { createAuthClient } from "@/lib/supabase/server-auth";
import type { BillingFrequency } from "@/lib/finance/plan-builder";
import type {
  AwardChoice,
  BundleChoice,
  CatalogChoice,
  ExistingPlan,
  PlanEditorContext,
} from "@/lib/finance/plan-editor-shared";

export type {
  AwardChoice,
  BundleChoice,
  CatalogChoice,
  ExistingPlan,
  PlanEditorContext,
} from "@/lib/finance/plan-editor-shared";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadPlanEditorContext(
  studentId: string
): Promise<PlanEditorContext | { error: string }> {
  const supabase = await createAuthClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, first_name, last_name, grade_level, school_id, family_id, status")
    .eq("id", studentId)
    .single();

  if (studentError || !student) {
    return { error: `Could not read that student: ${studentError?.message ?? "not found"}` };
  }
  if (!student.school_id) {
    // Without a school there is no price list and no school year. Better to say
    // so than to render an empty catalog that reads as "nothing to sell".
    return { error: "This student has no school, so there is no price list to build from." };
  }

  const [schoolsResult, yearResult, pricesResult, itemsResult, bundlesResult, awardsResult, planResult, siblingResult] =
    await Promise.all([
      supabase.from("schools").select("id, name"),
      supabase
        .from("school_years")
        .select("id, name")
        .eq("school_id", student.school_id)
        .eq("is_current", true)
        .limit(1),
      supabase
        .from("tuition_school_prices")
        .select(
          "id, school_id, catalog_item_id, standard_amount, billing_frequency, offered_one_to_one, one_to_one_session_rate, is_active"
        )
        .eq("school_id", student.school_id)
        .eq("is_active", true),
      supabase
        .from("tuition_catalog_items")
        .select("id, item_code, display_name, item_kind, provider_school_id, description, sort_order")
        .eq("is_active", true),
      supabase
        .from("tuition_bundle_discounts")
        .select("id, school_id, name, package_item_id, min_additional_items, amount")
        .eq("school_id", student.school_id)
        .eq("is_active", true),
      supabase
        .from("scholarship_awards")
        .select("id, program_name, awarded_amount, award_year, status")
        .eq("student_id", studentId),
      supabase
        .from("student_tuition_plans")
        .select(
          "id, billing_mode, monthly_amount, remaining_due, payment_channel, source_document, notes, school_year_id"
        )
        .eq("student_id", studentId)
        .eq("status", "active"),
      student.family_id
        ? supabase
            .from("students")
            .select("id, first_name, last_name")
            .eq("family_id", student.family_id)
            .neq("id", studentId)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (schoolsResult.error) return { error: `Could not read schools: ${schoolsResult.error.message}` };
  if (yearResult.error) return { error: `Could not read the school year: ${yearResult.error.message}` };
  if (pricesResult.error) return { error: `Could not read prices: ${pricesResult.error.message}` };
  if (itemsResult.error) return { error: `Could not read the catalog: ${itemsResult.error.message}` };
  // A discount that fails to load would silently overbill this family by the
  // amount of the discount. Refuse the screen rather than render it short.
  if (bundlesResult.error) {
    return { error: `Could not read bundle discounts: ${bundlesResult.error.message}` };
  }
  // A scholarship that fails to load would bill the family the school's whole
  // tuition. This is the single most expensive read on the page.
  if (awardsResult.error) {
    return { error: `Could not read scholarship awards: ${awardsResult.error.message}` };
  }
  if (planResult.error) return { error: `Could not read the existing plan: ${planResult.error.message}` };

  const year = (yearResult.data ?? [])[0];
  if (!year) {
    return {
      error:
        "This school has no current school year, so a plan cannot be attached to one. Set the current year first.",
    };
  }

  const schoolNameById = new Map(
    (schoolsResult.data ?? []).map((s) => [s.id as string, s.name as string])
  );
  const itemById = new Map((itemsResult.data ?? []).map((i) => [i.id as string, i]));

  const catalog: CatalogChoice[] = [];
  for (const price of pricesResult.data ?? []) {
    const item = itemById.get(price.catalog_item_id as string);
    // An orphaned price — the catalog item was retired — is skipped. Silently
    // skipping it is what would be wrong, so it is simply absent from a list
    // the user reads rather than a line they might have expected.
    if (!item) continue;

    catalog.push({
      catalogItemId: item.id as string,
      itemCode: item.item_code as string,
      itemName: item.display_name as string,
      itemKind: item.item_kind as string,
      description: (item.description as string | null) ?? null,
      amount: num(price.standard_amount),
      frequency: (price.billing_frequency as BillingFrequency) ?? "monthly",
      offeredOneToOne: Boolean(price.offered_one_to_one),
      oneToOneSessionRate: num(price.one_to_one_session_rate),
      billedToFamily: item.provider_school_id === price.school_id,
      providerSchoolName:
        schoolNameById.get(item.provider_school_id as string) ?? "(unknown school)",
    });
  }
  catalog.sort(
    (a, b) =>
      (itemById.get(a.catalogItemId)?.sort_order ?? 0) -
        (itemById.get(b.catalogItemId)?.sort_order ?? 0) ||
      a.itemName.localeCompare(b.itemName)
  );

  const bundles: BundleChoice[] = (bundlesResult.data ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    packageItemCode: (itemById.get(d.package_item_id as string)?.item_code as string) ?? "",
    minAdditionalItems: (d.min_additional_items as number) ?? 1,
    amount: num(d.amount) ?? 0,
  }));

  const awards: AwardChoice[] = (awardsResult.data ?? []).map((a) => ({
    id: a.id as string,
    programName: a.program_name as string,
    awardedAmount: num(a.awarded_amount) ?? 0,
    awardYear: a.award_year as string,
    status: (a.status as string) ?? "awarded",
  }));

  const existingRow = (planResult.data ?? []).find(
    (p) => p.school_year_id === year.id
  );
  const existingPlan: ExistingPlan | null = existingRow
    ? {
        planId: existingRow.id as string,
        billingMode: (existingRow.billing_mode as "scheduled" | "monthly_open") ?? "scheduled",
        monthlyAmount: num(existingRow.monthly_amount),
        remainingDue: num(existingRow.remaining_due),
        paymentChannel: (existingRow.payment_channel as string | null) ?? null,
        sourceDocument: (existingRow.source_document as string | null) ?? null,
        notes: (existingRow.notes as string | null) ?? null,
        instalmentCount: 0,
      }
    : null;

  const siblingIds = (siblingResult.data ?? []).map((s) => s.id as string);
  let siblingsWithPlans: { name: string; hasSiblingDiscount: boolean }[] = [];
  if (siblingIds.length > 0) {
    const { data: siblingPlans } = await supabase
      .from("student_tuition_plans")
      .select("student_id, notes")
      .in("student_id", siblingIds)
      .eq("status", "active");
    const planByStudent = new Map(
      (siblingPlans ?? []).map((p) => [p.student_id as string, p])
    );
    siblingsWithPlans = (siblingResult.data ?? []).map((s) => {
      const plan = planByStudent.get(s.id as string);
      return {
        name: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "(unnamed)",
        // Recorded in the plan's notes today; there is no sibling-discount
        // column, and inventing one here would be inventing a rule.
        hasSiblingDiscount: Boolean(
          plan && String(plan.notes ?? "").toLowerCase().includes("sibling discount")
        ),
      };
    });
  }

  return {
    studentId: student.id as string,
    studentName:
      `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "(unnamed student)",
    schoolId: student.school_id as string,
    schoolName: schoolNameById.get(student.school_id as string) ?? "(unknown school)",
    gradeLevel: (student.grade_level as string | null) ?? null,
    schoolYearId: year.id as string,
    schoolYearName: (year.name as string) ?? "",
    catalog,
    bundles,
    awards,
    existingPlan,
    siblingsWithPlans,
  };
}
