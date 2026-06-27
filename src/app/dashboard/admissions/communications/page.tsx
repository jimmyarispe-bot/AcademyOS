import { PageHeader } from "@/components/ui/PageHeader";
import { CommunicationTemplatesPanel } from "@/components/admissions/CommunicationTemplatesPanel";
import { getCommunicationTemplates } from "@/lib/admissions/communications/queries";

export default async function CommunicationsSettingsPage() {
  const templates = await getCommunicationTemplates();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Template Library"
        subtitle="Version-controlled email, SMS, and portal templates with merge fields and school overrides"
        backHref="/dashboard/admissions"
      />
      <CommunicationTemplatesPanel templates={templates} />
    </div>
  );
}
