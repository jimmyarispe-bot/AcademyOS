import { redirect } from "next/navigation";
import Link from "next/link";
import { ApplyShell } from "@/components/admissions/portal/ApplyShell";
import { FamilyFinancialCenter } from "@/components/finance/FamilyFinancialCenter";
import { getSessionUser } from "@/lib/auth/session";
import { getGuardianFamilyFinancialProfiles } from "@/lib/finance/family-center";
import { createAuthClient } from "@/lib/supabase/server-auth";

export default async function PortalFinancePage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/apply/portal/finance");

  const supabase = await createAuthClient();
  const profiles = await getGuardianFamilyFinancialProfiles(supabase, sessionUser.id);

  return (
    <ApplyShell userEmail={sessionUser.email}>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-brand-600">
            <Link href="/apply/portal" className="hover:underline">← Back to portal</Link>
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Family Financial Center</h1>
          <p className="mt-1 text-slate-600">View invoices, payment methods, scholarships, and payment history.</p>
        </div>

        {!profiles.length && (
          <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            No billing account linked to your guardian profile yet. Contact the school finance office.
          </p>
        )}

        {profiles.map((profile) => (
          <div key={profile.family.id as string}>
            <h2 className="mb-4 text-xl font-semibold text-slate-900">{profile.family.family_name as string}</h2>
            <FamilyFinancialCenter
              familyId={profile.family.id as string}
              profile={profile as Parameters<typeof FamilyFinancialCenter>[0]["profile"]}
              portalMode
            />
          </div>
        ))}
      </div>
    </ApplyShell>
  );
}
