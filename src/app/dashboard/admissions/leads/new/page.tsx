import { PageHeader } from "@/components/ui/PageHeader";
import { LeadForm } from "@/components/admissions/LeadForm";
import { getSchools } from "@/lib/admissions/queries";

export default async function NewLeadPage() {
  const schools = await getSchools();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add Lead"
        subtitle="Create a new admissions inquiry"
        backHref="/dashboard/admissions"
      />
      <LeadForm schools={schools} />
    </div>
  );
}
