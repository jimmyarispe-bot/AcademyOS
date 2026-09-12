/**
 * Inviting parents into JAG.
 *
 * Every piece of this already existed for staff: `createManagedUser` makes the
 * auth user, delivers the invitation through Resend rather than Supabase SMTP,
 * and gates the account behind `invite_activation` until the person sets a
 * password at /login/activate. A `PARENT` role exists with its own permission
 * group. None of it had ever been pointed at a guardian.
 *
 * The one genuinely missing step is the link: setting `guardians.user_id` so
 * that the account a parent activates is connected to the family record the
 * portal reads. Without it a parent signs in successfully and sees nothing,
 * which is the worst of the three possible outcomes because it looks like it
 * worked.
 *
 * WHY NOT `inviteManagedUsers`. That helper invents a name from the email local
 * part — `katieallen315@yahoo.com` becomes "Katieallen315 User". For staff
 * typing addresses into a box that is a reasonable guess. For guardians we hold
 * actual names and should use them.
 *
 * THIS SENDS REAL EMAIL TO REAL FAMILIES. Every function here is either a
 * preview or requires an explicit confirmation, and the send is capped per call.
 * There is deliberately no "invite everyone at every campus" path.
 */

import { createServiceRoleClient } from "@/lib/supabase/server";
import { createManagedUser } from "@/lib/platform/identity/user-management";
import { PARENT_INVITE_BATCH_LIMIT } from "@/lib/portal/parent-invite-limits";

export { PARENT_INVITE_BATCH_LIMIT } from "@/lib/portal/parent-invite-limits";

export type GuardianInviteCandidate = {
  readonly guardianId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string | null;
  readonly familyName: string | null;
  readonly schoolId: string | null;
  readonly needsConfirmation: boolean;
  /** Set when this guardian will NOT be invited, and why. */
  readonly skip: "no_email" | "already_linked" | null;
};

type GuardianRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  user_id: string | null;
  communication_preferences: Record<string, unknown> | null;
  families: { family_name: string | null; school_id: string | null } | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Everyone at a school, with the reason anyone is being skipped stated rather
 * than filtered away silently. A list that quietly omits half a campus is a
 * list nobody can check.
 */
export async function listGuardianInviteCandidates(
  schoolId: string
): Promise<GuardianInviteCandidate[]> {
  const admin = createServiceRoleClient();

  const { data, error } = await admin
    .from("guardians")
    .select(
      "id, first_name, last_name, email, user_id, communication_preferences, families!inner(family_name, school_id)"
    )
    .eq("families.school_id", schoolId)
    .order("last_name", { ascending: true });

  if (error) {
    console.error("[parent-invites] could not list guardians", error.message);
    return [];
  }

  return ((data ?? []) as unknown as GuardianRow[]).map((row) => {
    const email = clean(row.email);
    const prefs = row.communication_preferences ?? {};
    return {
      guardianId: row.id,
      firstName: clean(row.first_name) ?? "Parent/Guardian",
      lastName: clean(row.last_name) ?? "Household",
      email,
      familyName: clean(row.families?.family_name ?? null),
      schoolId: row.families?.school_id ?? null,
      needsConfirmation: prefs.needs_confirmation === true,
      skip: row.user_id ? "already_linked" : email ? null : "no_email",
    };
  });
}

export type ParentInviteOutcome = {
  readonly guardianId: string;
  readonly email: string;
  readonly ok: boolean;
  readonly error?: string;
};

/**
 * Invite specific guardians. Named ids only — there is no "invite all" here,
 * because the difference between sending 3 emails and sending 94 should be a
 * deliberate act rather than a default.
 */
export async function inviteGuardians(input: {
  guardianIds: readonly string[];
  organizationId: string;
  schoolId: string;
}): Promise<{ invited: ParentInviteOutcome[]; skipped: number }> {
  const admin = createServiceRoleClient();
  const ids = input.guardianIds.slice(0, PARENT_INVITE_BATCH_LIMIT);
  if (!ids.length) return { invited: [], skipped: 0 };

  const { data, error } = await admin
    .from("guardians")
    .select("id, first_name, last_name, email, user_id")
    .in("id", ids);

  if (error) {
    console.error("[parent-invites] could not load guardians", error.message);
    return { invited: [], skipped: ids.length };
  }

  const rows = (data ?? []) as unknown as GuardianRow[];
  const invited: ParentInviteOutcome[] = [];
  let skipped = 0;

  for (const row of rows) {
    const email = clean(row.email);

    // Re-checked here, not only in the preview. The list a person looked at may
    // be minutes old, and inviting somebody twice sends them a second set of
    // credentials for an account they already activated.
    if (!email || row.user_id) {
      skipped += 1;
      continue;
    }

    const result = await createManagedUser({
      firstName: clean(row.first_name) ?? "Parent/Guardian",
      lastName: clean(row.last_name) ?? "Household",
      email,
      organizationId: input.organizationId,
      schoolIds: [input.schoolId],
      role: "PARENT",
      status: "pending_invite",
    });

    if (!result.success) {
      invited.push({ guardianId: row.id, email, ok: false, error: result.error });
      continue;
    }

    /**
     * The link. Everything above this line already worked for staff; without
     * this line a parent activates an account and the portal shows them
     * nothing, because it looks for a guardian row by user_id.
     *
     * The error is checked rather than assumed — an invitation that landed and
     * a link that did not is the one combination that produces a confused
     * family and no trace of why.
     */
    const { error: linkError } = await admin
      .from("guardians")
      .update({ user_id: result.userId })
      .eq("id", row.id);

    if (linkError) {
      console.error("[parent-invites] invited but not linked", {
        guardianId: row.id,
        userId: result.userId,
        error: linkError.message,
      });
      invited.push({
        guardianId: row.id,
        email,
        ok: false,
        error: `Invitation sent, but the account was not linked to the family record: ${linkError.message}`,
      });
      continue;
    }

    invited.push({ guardianId: row.id, email, ok: true });
  }

  return { invited, skipped };
}
