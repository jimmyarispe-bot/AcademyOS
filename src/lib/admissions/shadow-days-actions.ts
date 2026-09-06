"use server";

import { revalidatePath } from "next/cache";

import { transitionCaseStage } from "@/lib/admissions/case/orchestration";
import { assertAnyPermission } from "@/lib/platform/identity/action-guards";

/**
 * Record that a child has finished their shadow days.
 *
 * A named action rather than a generic "set the stage to anything" control. The
 * stage this moves to is the one gate 3 opens at, so this click is really the
 * moment a school leader is asked to accept or deny — and a button whose label
 * says what happened is auditable in a way that a dropdown of nineteen stages
 * is not.
 *
 * Everything downstream is already built: `transitionCaseStage` records the
 * activity, syncs the platform workflow, and opens the accept-or-deny gate. The
 * only missing piece was ever the transition itself.
 *
 * Permission mirrors the gates: managing admissions or being able to accept.
 * Someone who can answer gate 3 can also say the shadow days that lead to it
 * are done.
 */
export async function markShadowDaysComplete(leadId: string) {
  const auth = await assertAnyPermission("admissions.manage", "admissions.accept");
  if ("error" in auth) return { error: auth.error };

  const supabase = auth.supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await transitionCaseStage(
    supabase,
    leadId,
    "shadow_day_completed",
    user?.id ?? null
  );

  // The gate opens inside transitionCaseStage and its failure is deliberately
  // swallowed there — the stage HAS moved, and reporting that as a failure
  // would be a lie. So a caller seeing success here should still check the
  // decisions page; that is why the panel says so rather than implying the
  // decision definitely appeared.
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/admissions/shadow-days");
  revalidatePath("/dashboard/admissions/decisions");
  revalidatePath("/dashboard/admissions");
  revalidatePath(`/dashboard/admissions/cases/${leadId}`);

  return { success: true as const };
}
