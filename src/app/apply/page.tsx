import { ApplyShell } from "@/components/admissions/portal/ApplyShell";
import { ParentInquiryForm } from "@/components/admissions/portal/ParentInquiryForm";
import { getSchoolsForInquiry } from "@/lib/admissions/portal/queries";

export const metadata = {
  title: "Admissions Inquiry | AcademyOS",
  description: "Submit a parent inquiry to begin the admissions process.",
};

export default async function ApplyInquiryPage() {
  const schools = await getSchoolsForInquiry();

  return (
    <ApplyShell>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Start Your Admissions Journey
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Complete this inquiry form to connect with our admissions team. After submitting, sign in
          with your guardian email to access the application portal, document center, and progress
          tracker.
        </p>
      </div>
      <ParentInquiryForm schools={schools} />
      </div>
    </ApplyShell>
  );
}
