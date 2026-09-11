import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplyShell } from "@/components/admissions/portal/ApplyShell";
import { ApplicationWizard } from "@/components/admissions/experience/ApplicationWizard";
import { DocumentCenter } from "@/components/admissions/portal/DocumentCenter";
import { getSessionUser } from "@/lib/auth/session";
import {
  getApplicationDocuments,
  getPortalApplication,
} from "@/lib/admissions/portal/queries";

interface WizardPageProps {
  params: Promise<{ applicationId: string }>;
}

export default async function ApplicationWizardPage({ params }: WizardPageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/login?next=/apply/portal");
  }

  const { applicationId } = await params;
  const portalData = await getPortalApplication(applicationId);
  if (!portalData) notFound();

  const documents = await getApplicationDocuments(applicationId);
  const { application } = portalData;

  /**
   * The three columns migration 321 added, read through a narrow cast.
   *
   * 321 was hand-run, so `guardian_notes`, `student_summary` and
   * `medical_notes` are absent from the generated `database.ts` until types are
   * regenerated. Naming exactly the three keeps every other field on the row
   * type-checked; widening `application` itself would silence real errors.
   */
  const wizardColumns = application as unknown as {
    guardian_notes?: string | null;
    student_summary?: string | null;
    medical_notes?: string | null;
  };

  return (
    <ApplyShell userEmail={sessionUser.email}>
      <div className="space-y-6">
        <div>
          <Link
            href={`/apply/portal/${applicationId}`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to application
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Application wizard
          </h1>
          <p className="mt-1 text-slate-600">
            Multi-step application with draft save and progress — uses existing admissions services.
          </p>
        </div>

        <ApplicationWizard
          applicationId={applicationId}
          defaults={{
            previous_school: application.previous_school,
            emergency_contact_name: application.emergency_contact_name,
            emergency_contact_phone: application.emergency_contact_phone,
            learning_needs_summary: application.learning_needs_summary,
            guardian_notes: wizardColumns.guardian_notes ?? null,
            student_summary: wizardColumns.student_summary ?? null,
            medical_notes: wizardColumns.medical_notes ?? null,
          }}
        />

        <DocumentCenter
          applicationId={applicationId}
          applicationDocuments={documents}
          stateFundingDocuments={documents.filter((d) => d.document_subtype === "state_funding")}
          showStateFunding={false}
        />
      </div>
    </ApplyShell>
  );
}
