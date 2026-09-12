import { ApplyShell } from "@/components/admissions/portal/ApplyShell";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { loadOrganizationBranding } from "@/lib/branding";
import { resolveInterestFormOrganization } from "@/lib/admissions/interest-form/org-resolve";

interface ThankYouPageProps {
  searchParams: Promise<{ lead?: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The school the family actually chose, read back from their own lead.
 *
 * Not taken from the query string: anything a visitor can edit is a claim, and
 * a page that thanks somebody for their interest in a school they never picked
 * is worse than one that names the network. The lead id is an unguessable
 * UUID and a school's name is public, so reading it with the service role costs
 * nothing and gives the family the name they expect to see.
 *
 * Every failure returns null and the caller falls back to the network name. A
 * thank-you page is not worth a 500.
 */
async function schoolForLead(
  leadId: string | undefined
): Promise<{ name: string | null; meetsVirtually: boolean }> {
  if (!leadId || !UUID.test(leadId)) return { name: null, meetsVirtually: false };
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("admissions_leads")
      .select("schools(name, meets_virtually)")
      .eq("id", leadId)
      .maybeSingle();
    if (error || !data) return { name: null, meetsVirtually: false };
    const schools = (data as Record<string, unknown>).schools as
      | { name?: string; meets_virtually?: boolean }
      | null;
    const name = typeof schools?.name === "string" ? schools.name.trim() : "";
    return { name: name || null, meetsVirtually: schools?.meets_virtually === true };
  } catch {
    return { name: null, meetsVirtually: false };
  }
}

export default async function ApplyThankYouPage({ searchParams }: ThankYouPageProps) {
  const { lead } = await searchParams;
  const supabase = await createAuthClient();
  const [branding, org, school] = await Promise.all([
    loadOrganizationBranding(supabase),
    resolveInterestFormOrganization(),
    schoolForLead(lead),
  ]);

  const name = school.name ?? org?.organizationName ?? branding.productName;

  /**
   * What the family is being invited to book.
   *
   * A campus with a building offers a tour. The high school and Virtual have no
   * building, and offering a tour of one would be a promise nobody can keep —
   * so they offer the thing they actually do.
   *
   * Falls back to the in-person wording when the school could not be read,
   * which is the same case where the page names the network rather than a
   * campus. Vaguer, but never wrong about a specific school.
   */
  const nextStep = school.meetsVirtually
    ? "schedule a day/time to meet virtually with them"
    : "schedule your tour or meeting";

  return (
    // No navigation, and no buttons below. A family who has just submitted an
    // enquiry has one thing to do next, which is read the email we are about to
    // send them. Every link here is a way to end up somewhere they cannot use.
    <ApplyShell organizationName={org?.organizationName} showNav={false}>
      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Inquiry Received</h1>
        <p className="mt-2 text-slate-600">
          Thank you for your interest in {name}. Our admissions team is sending you an email now for
          you to {nextStep}.
        </p>
        {lead && (
          <p className="mt-3 text-xs text-slate-400">Reference: {lead.slice(0, 8).toUpperCase()}</p>
        )}
      </div>
    </ApplyShell>
  );
}
