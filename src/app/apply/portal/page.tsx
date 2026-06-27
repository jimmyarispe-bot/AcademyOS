import { redirect } from "next/navigation";
import { ApplyShell } from "@/components/admissions/portal/ApplyShell";
import { PortalLeadList } from "@/components/admissions/portal/PortalLeadList";
import { getSessionUser } from "@/lib/auth/session";
import {
  getCurrentSchoolYear,
  getGuardianPortalLeads,
} from "@/lib/admissions/portal/queries";

export const metadata = {
  title: "Application Portal | AcademyOS",
};

export default async function ApplyPortalPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/login?next=/apply/portal");
  }

  const leads = await getGuardianPortalLeads(sessionUser.email);
  const schoolIds = [...new Set(leads.map((l) => l.school_id))];
  const schoolYearEntries = await Promise.all(
    schoolIds.map(async (schoolId) => [schoolId, await getCurrentSchoolYear(schoolId)] as const)
  );
  const schoolYearBySchool: Record<string, { id: string; name: string } | undefined> =
    Object.fromEntries(
      schoolYearEntries.map(([schoolId, year]) => [schoolId, year ?? undefined])
    );

  return (
    <ApplyShell userEmail={sessionUser.email}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Application Portal</h1>
          <p className="mt-2 text-slate-600">
            Continue applications, upload documents, and track admissions progress.
          </p>
        </div>
        <PortalLeadList leads={leads} schoolYearBySchool={schoolYearBySchool} />
      </div>
    </ApplyShell>
  );
}
