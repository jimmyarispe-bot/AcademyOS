/**
 * Who hears that an inquiry arrived, and whose calendar a parent books.
 *
 * Those were the same person for as long as they were the same column.
 * `schools.admissions_contact_email` answered both questions, so a campus could
 * only ever notify one person, and adding a second meant choosing whose booking
 * link to lose. Migration 327 split them: many rows may receive notifications,
 * exactly one may be the booking contact, and the database enforces the second
 * part with a partial unique index rather than trusting a form to.
 *
 * FALLBACK IS DELIBERATE AND NOT TEMPORARY. If the table is empty for a school
 * — or absent entirely, because 327 has not been run where this code is
 * deployed — the school's own columns still answer. A communications engine
 * that stops notifying anybody because a migration is pending would be a worse
 * failure than the one being fixed.
 */

import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface SchoolAdmissionsContacts {
  /** Every address that should be told. May be empty. */
  readonly notificationEmails: readonly string[];
  /** The single person whose name signs parent mail and whose calendar is booked. */
  readonly contactName: string | null;
  readonly contactEmail: string | null;
  readonly bookingUrl: string | null;
}

type ContactRow = {
  name: string | null;
  email: string | null;
  receives_notifications: boolean | null;
  is_booking_contact: boolean | null;
  booking_url: string | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Resolve a school's contacts, preferring the table and falling back to the
 * school's own columns.
 *
 * `fallback` is what the caller already has in hand from the lead's joined
 * school row, so this costs one query and never a second lookup of something
 * already loaded.
 */
export async function resolveSchoolAdmissionsContacts(
  supabase: AuthClient,
  schoolId: string | null,
  fallback: {
    contactName?: string | null;
    contactEmail?: string | null;
    bookingUrl?: string | null;
  }
): Promise<SchoolAdmissionsContacts> {
  const fallbackContacts: SchoolAdmissionsContacts = {
    notificationEmails: clean(fallback.contactEmail) ? [clean(fallback.contactEmail)!] : [],
    contactName: clean(fallback.contactName),
    contactEmail: clean(fallback.contactEmail),
    bookingUrl: clean(fallback.bookingUrl),
  };

  if (!schoolId) return fallbackContacts;

  /**
   * The error is read rather than ignored. A missing table, a policy refusal
   * and an empty result are three different things, and supabase-js reports the
   * first two the same way it reports the third — by resolving, with an error
   * object nobody is obliged to look at. Falling back silently on a refusal
   * would mean one person keeps getting notified and nobody ever learns why the
   * other two do not.
   */
  const { data, error } = await supabase
    .from("school_admissions_contacts" as never)
    .select("name, email, receives_notifications, is_booking_contact, booking_url")
    .eq("school_id", schoolId)
    .eq("is_active", true);

  if (error) {
    console.error("[communications] school_admissions_contacts unavailable", {
      schoolId,
      error: error.message,
    });
    return fallbackContacts;
  }

  const rows = (data ?? []) as unknown as ContactRow[];
  if (!rows.length) return fallbackContacts;

  const notificationEmails = Array.from(
    new Set(
      rows
        .filter((row) => row.receives_notifications !== false)
        .map((row) => clean(row.email))
        .filter((email): email is string => Boolean(email))
    )
  );

  const booking = rows.find((row) => row.is_booking_contact) ?? null;

  return {
    // An empty table row set is handled above; an empty *notification* set here
    // means every contact has notifications switched off, which is a choice
    // somebody made and is not overridden.
    notificationEmails,
    contactName: clean(booking?.name) ?? fallbackContacts.contactName,
    contactEmail: clean(booking?.email) ?? fallbackContacts.contactEmail,
    bookingUrl: clean(booking?.booking_url) ?? fallbackContacts.bookingUrl,
  };
}
