"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { completeObligationAndScheduleNext } from "@/lib/compliance/registry";
import { assertParentStudentAccess } from "@/lib/platform/identity/portal-access";
import { getStudentSelfId } from "@/lib/platform/identity/portal-access";

export async function completePortalObligationAction(obligationId: string) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: ob } = await supabase
    .from("compliance_obligations")
    .select("id, assignee_type, student_id, parent_can_complete, guardian_user_id")
    .eq("id", obligationId)
    .single();

  if (!ob) return { error: "Not found" };

  if (ob.assignee_type === "parent") {
    if (!ob.parent_can_complete) return { error: "This item cannot be marked complete from the portal" };
    if (ob.guardian_user_id !== user.id) {
      if (!ob.student_id || !(await assertParentStudentAccess(supabase, user.id, ob.student_id))) {
        return { error: "Access denied" };
      }
    }
  } else if (ob.assignee_type === "student") {
    const selfId = await getStudentSelfId(supabase, user.id);
    if (selfId !== ob.student_id) return { error: "Access denied" };
  } else {
    return { error: "This obligation must be completed in the staff workspace" };
  }

  const result = await completeObligationAndScheduleNext(supabase, obligationId, user.id);
  if (result.error) return { error: result.error };

  revalidatePath("/portal");
  revalidatePath("/portal/student");
  return { success: true };
}
