"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { inviteGuardians } from "@/lib/portal/parent-invites";
import { PARENT_INVITE_BATCH_LIMIT } from "@/lib/portal/parent-invite-limits";

/**
 * Send invitations to named guardians at one school.
 *
 * PERMISSION is enforced inside `createManagedUser`, which requires
 * `users.manage` on the calling session before it will provision anybody. It is
 * not re-checked here, because two checks that can disagree are worse than one
 * that cannot.
 *
 * THE CONFIRMATION IS NOT DECORATION. This sends real email to real families,
 * and an accidental click is not undoable by any means available to us — an
 * email that has left cannot be recalled, and 94 families receiving unexpected
 * login credentials from their child's school is a support morning nobody
 * wants. The caller must pass the literal word SEND.
 */
export async function inviteGuardiansAction(formData: FormData) {
  const schoolId = String(formData.get("school_id") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();
  const guardianIds = formData.getAll("guardian_ids").map(String).filter(Boolean);

  if (!schoolId) return { error: "Choose a school first." };
  if (!guardianIds.length) return { error: "Nobody is selected." };
  if (confirm !== "SEND") {
    return { error: "Type SEND to confirm. These are real emails to real families." };
  }
  if (guardianIds.length > PARENT_INVITE_BATCH_LIMIT) {
    return {
      error: `Select ${PARENT_INVITE_BATCH_LIMIT} or fewer at a time. Sending in batches means a mistake reaches ${PARENT_INVITE_BATCH_LIMIT} families rather than all of them.`,
    };
  }

  const supabase = await createAuthClient();
  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("id, organization_id, name")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError) return { error: schoolError.message };
  if (!school?.organization_id) {
    return { error: "That school has no organization, so an account cannot be created." };
  }

  const result = await inviteGuardians({
    guardianIds,
    organizationId: school.organization_id,
    schoolId,
  });

  revalidatePath("/dashboard/admin/parent-invites");

  const sent = result.invited.filter((r) => r.ok).length;
  const failures = result.invited.filter((r) => !r.ok);

  return {
    success: true as const,
    sent,
    skipped: result.skipped,
    failures: failures.map((f) => `${f.email}: ${f.error ?? "unknown error"}`),
  };
}
