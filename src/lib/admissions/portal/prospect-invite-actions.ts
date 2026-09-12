"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import {
  PROSPECT_INVITE_BATCH_LIMIT,
  inviteProspectGuardians,
} from "@/lib/admissions/portal/prospect-invites";

/**
 * Invite the parents on one admissions case into the application portal.
 *
 * PERMISSION is enforced inside `createManagedUser`, which requires
 * `users.manage` on the calling session before it will provision anybody. It is
 * not re-checked here, because two checks that can disagree are worse than one
 * that cannot.
 *
 * THE CONFIRMATION IS NOT DECORATION. This sends real email to a real family,
 * and an email that has left cannot be recalled. The caller must pass the
 * literal word SEND.
 *
 * ONE FAMILY PER CALL. The lead id scopes the query, so there is no shape of
 * this call that reaches a second household — the way an "invite everybody at
 * this campus" button eventually would.
 */
export async function inviteProspectGuardiansAction(formData: FormData) {
  const leadId = String(formData.get("lead_id") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();
  const guardianIds = formData.getAll("guardian_ids").map(String).filter(Boolean);

  if (!leadId) return { error: "No case selected." };
  if (!guardianIds.length) return { error: "Nobody is selected." };
  if (confirm !== "SEND") {
    return { error: "Type SEND to confirm. This is a real email to a real family." };
  }
  if (guardianIds.length > PROSPECT_INVITE_BATCH_LIMIT) {
    return { error: `Select ${PROSPECT_INVITE_BATCH_LIMIT} or fewer at a time.` };
  }

  const supabase = await createAuthClient();

  // The school comes from the lead, never from the form. A school id posted by a
  // browser is a school id somebody can change.
  const { data: lead, error: leadError } = await supabase
    .from("admissions_leads")
    .select("id, school_id, schools(name, organization_id)")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) return { error: leadError.message };
  if (!lead) return { error: "That case could not be found." };

  const school = (lead as { schools?: { name?: string; organization_id?: string } | null })
    .schools;

  if (!school?.organization_id) {
    return {
      error:
        "That campus has no organization set, so an account cannot be created. Fix the campus first.",
    };
  }

  const result = await inviteProspectGuardians({
    leadId,
    guardianIds,
    organizationId: school.organization_id,
    schoolId: String((lead as { school_id: string }).school_id),
  });

  revalidatePath(`/dashboard/admissions/cases/${leadId}`);

  const sent = result.invited.filter((r) => r.ok);
  const failures = result.invited.filter((r) => !r.ok);

  if (!sent.length && failures.length) {
    return { error: failures.map((f) => `${f.email}: ${f.error}`).join(" · ") };
  }

  const parts: string[] = [];
  parts.push(
    sent.length === 1
      ? `Invitation sent to ${sent[0]!.email}.`
      : `${sent.length} invitations sent.`
  );
  if (failures.length) {
    parts.push(`Not sent — ${failures.map((f) => `${f.email}: ${f.error}`).join(" · ")}`);
  }
  if (result.skipped) {
    parts.push(`${result.skipped} skipped for having no email address.`);
  }

  return { success: true, message: parts.join(" ") };
}
