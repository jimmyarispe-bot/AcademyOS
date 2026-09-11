import { describe, expect, it, vi } from "vitest";
import { resolveSchoolAdmissionsContacts } from "@/lib/admissions/communications/staff-recipients";

type Row = {
  name: string | null;
  email: string | null;
  receives_notifications: boolean | null;
  is_booking_contact: boolean | null;
  booking_url: string | null;
};

/**
 * The query is `.from().select().eq().eq()` and the last call is awaited, so the
 * final link in the chain is the thenable.
 */
function client(result: { data: Row[] | null; error: { message: string } | null }) {
  const tail = {
    eq: () => tail,
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return {
    from: () => ({ select: () => tail }),
  } as never;
}

const FALLBACK = {
  contactName: "Admissions",
  contactEmail: "admissions@example.org",
  bookingUrl: "https://calendar.example.org/admissions",
};

describe("resolveSchoolAdmissionsContacts", () => {
  it("notifies everyone, and books only the booking contact", async () => {
    const contacts = await resolveSchoolAdmissionsContacts(
      client({
        data: [
          {
            name: "Danni Treu",
            email: "danni@example.org",
            receives_notifications: true,
            is_booking_contact: true,
            booking_url: "https://calendar.example.org/danni",
          },
          {
            name: "Nina Gaddy",
            email: "nina@example.org",
            receives_notifications: true,
            is_booking_contact: false,
            booking_url: null,
          },
        ],
        error: null,
      }),
      "school-1",
      FALLBACK
    );

    expect(contacts.notificationEmails).toEqual(["danni@example.org", "nina@example.org"]);
    expect(contacts.contactName).toBe("Danni Treu");
    expect(contacts.bookingUrl).toBe("https://calendar.example.org/danni");
  });

  it("leaves out anyone who has notifications switched off", async () => {
    const contacts = await resolveSchoolAdmissionsContacts(
      client({
        data: [
          {
            name: "Danni",
            email: "danni@example.org",
            receives_notifications: true,
            is_booking_contact: true,
            booking_url: null,
          },
          {
            name: "Quiet",
            email: "quiet@example.org",
            receives_notifications: false,
            is_booking_contact: false,
            booking_url: null,
          },
        ],
        error: null,
      }),
      "school-1",
      FALLBACK
    );

    expect(contacts.notificationEmails).toEqual(["danni@example.org"]);
  });

  it("falls back to the school's own columns when the table is empty", async () => {
    const contacts = await resolveSchoolAdmissionsContacts(
      client({ data: [], error: null }),
      "school-1",
      FALLBACK
    );

    expect(contacts.notificationEmails).toEqual(["admissions@example.org"]);
    expect(contacts.contactEmail).toBe("admissions@example.org");
    expect(contacts.bookingUrl).toBe(FALLBACK.bookingUrl);
  });

  it("falls back — and says so — when the table cannot be read at all", async () => {
    // Migration 327 not run where this is deployed, or a policy refusal. Both
    // arrive as an error object nobody is obliged to look at. Notifications must
    // not stop because a migration is pending, but it must not be silent either.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const contacts = await resolveSchoolAdmissionsContacts(
      client({ data: null, error: { message: 'relation "school_admissions_contacts" does not exist' } }),
      "school-1",
      FALLBACK
    );

    expect(contacts.notificationEmails).toEqual(["admissions@example.org"]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns nothing to notify when the school has no contact anywhere", async () => {
    const contacts = await resolveSchoolAdmissionsContacts(
      client({ data: [], error: null }),
      "school-1",
      { contactName: null, contactEmail: null, bookingUrl: null }
    );

    // triggerCommunications drops the staff template on this, rather than
    // queueing a delivery addressed to the empty string.
    expect(contacts.notificationEmails).toEqual([]);
  });

  it("does not address the same person twice", async () => {
    const contacts = await resolveSchoolAdmissionsContacts(
      client({
        data: [
          {
            name: "Heather",
            email: "heather@example.org",
            receives_notifications: true,
            is_booking_contact: true,
            booking_url: null,
          },
          {
            name: "Heather again",
            email: "heather@example.org",
            receives_notifications: true,
            is_booking_contact: false,
            booking_url: null,
          },
        ],
        error: null,
      }),
      "school-1",
      FALLBACK
    );

    expect(contacts.notificationEmails).toEqual(["heather@example.org"]);
  });

  it("skips the query entirely with no school", async () => {
    const contacts = await resolveSchoolAdmissionsContacts(
      client({ data: [], error: null }),
      null,
      FALLBACK
    );

    expect(contacts.contactEmail).toBe("admissions@example.org");
  });
});
