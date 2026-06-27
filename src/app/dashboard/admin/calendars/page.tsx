import { ConfigStudioShell } from "@/components/configuration/ConfigStudioNav";
import { ConfigSectionForm } from "@/components/configuration/ConfigSectionForm";
import { loadConfigPage } from "@/lib/configuration/page-data";
import Link from "next/link";

export default async function CalendarsConfigPage() {
  const { organizationId, config } = await loadConfigPage("academic");

  return (
    <ConfigStudioShell title="Calendars" subtitle="School years, terms, and academic calendar configuration">
      <ConfigSectionForm
        sectionKey="academic"
        organizationId={organizationId}
        title="Academic calendar"
        config={config}
        fields={[
          { name: "timezone", label: "Calendar time zone", placeholder: "America/New_York" },
        ]}
      />
      <Link href="/dashboard/scheduling" className="text-sm text-brand-600 hover:underline">
        Open scheduling module for session calendars →
      </Link>
    </ConfigStudioShell>
  );
}
