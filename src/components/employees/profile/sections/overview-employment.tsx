import { ProfileNotesPanel } from "@/components/platform/profile-sections/ProfileNotesPanel";
import { ProfilePlaceholderPanel } from "@/components/platform/profile-sections/ProfilePlaceholderPanel";
import { ProfileRecordTable } from "@/components/platform/profile-sections/ProfileRecordTable";
import { ProfileStatGrid } from "@/components/platform/profile-sections/ProfileStatGrid";
import { ProfileTagsList } from "@/components/platform/profile-sections/ProfileTagsList";
import { ProfileCard, ProfileEmpty, ProfileItem } from "@/components/platform/profile-workspace/ProfilePrimitives";
import { ProfileSectionPlaceholder } from "@/components/platform/profile-workspace/ProfileSectionPlaceholder";
import {
  employeeSchoolName,
  formatLabel,
  missingSection,
  pickEmployeeProfile,
} from "@/components/employees/profile/sections/shared";
import type { ProfileSectionViewProps } from "@/lib/platform/profile/sections/types";
import type { PlatformEntityTag } from "@/lib/platform/tags/types";
import { EmailLink } from "@/components/platform/contact/ContactLink";

type OverviewData = {
  employee: Record<string, unknown>;
  certifications: Record<string, unknown>[];
  onboarding: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  tags: PlatformEntityTag[];
};

export function OverviewSection(props: ProfileSectionViewProps) {
  const data = props.data as OverviewData | null;
  if (!data?.employee) {
    return missingSection("Overview");
  }

  const emp = data.employee;
  const ep = pickEmployeeProfile(emp);
  const pendingOnboarding = data.onboarding.filter((t) => t.status !== "completed");

  return (
    <div className="space-y-6">
      <ProfileStatGrid
        items={[
          { label: "Type", value: formatLabel(emp.employee_type) },
          { label: "Hire date", value: formatLabel(emp.hire_date) },
          { label: "Department", value: formatLabel(emp.department) },
          { label: "Certifications", value: String(data.certifications.length) },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard title="Contact & Emergency">
          <dl className="grid gap-3 sm:grid-cols-2">
            <ProfileItem label="Email" value={<EmailLink email={ep?.contact_email as string | null} />} />
            <ProfileItem label="Job title" value={formatLabel(ep?.job_title)} />
            <ProfileItem label="School" value={employeeSchoolName(emp)} />
            <ProfileItem label="Emergency contact" value={formatLabel(ep?.emergency_contact_name)} />
          </dl>
        </ProfileCard>

        <ProfileCard title="Onboarding">
          {pendingOnboarding.length === 0 ? (
            <ProfileEmpty>All onboarding tasks complete</ProfileEmpty>
          ) : (
            <ul className="space-y-2 text-sm">
              {pendingOnboarding.map((task) => (
                <li
                  key={String(task.id)}
                  className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span>{String(task.title ?? "Task")}</span>
                  <span className="capitalize text-slate-500">{formatLabel(task.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </ProfileCard>
      </div>

      {data.tags.length > 0 && <ProfileTagsList tags={data.tags} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard title="Recent Documents">
          {data.documents.length === 0 ? (
            <ProfileEmpty>No documents on file</ProfileEmpty>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.documents.map((doc) => (
                <li key={String(doc.id)} className="rounded-lg bg-slate-50 px-3 py-2 capitalize">
                  {formatLabel(doc.document_type)} — {String(doc.file_name ?? "Document")}
                </li>
              ))}
            </ul>
          )}
        </ProfileCard>
        <ProfileCard title="Credentials">
          <p className="text-sm text-slate-600">
            {data.certifications.length} certification(s) on file. Open the Certifications
            section for full detail.
          </p>
        </ProfileCard>
      </div>
    </div>
  );
}

export function EmploymentInformationSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    employee: Record<string, unknown> | null;
    serviceHistory: Record<string, unknown>[];
  } | null;
  if (!data?.employee) return missingSection("Employment Information");

  const emp = data.employee;
  const ep = pickEmployeeProfile(emp);

  return (
    <div className="space-y-6">
      <ProfileCard title="Employment Details">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileItem label="Employment status" value={formatLabel(emp.employment_status)} />
          <ProfileItem label="Employee type" value={formatLabel(emp.employee_type)} />
          <ProfileItem label="Hire date" value={formatLabel(emp.hire_date)} />
          <ProfileItem label="Department" value={formatLabel(emp.department)} />
          <ProfileItem label="Job title" value={formatLabel(ep?.job_title)} />
          <ProfileItem label="School" value={employeeSchoolName(emp)} />
        </dl>
      </ProfileCard>

      <ProfileRecordTable
        title="Service History"
        records={data.serviceHistory}
        emptyMessage="No service history recorded"
        columns={[
          { key: "effective_date", label: "Effective" },
          { key: "title", label: "Title" },
          { key: "change_type", label: "Change", render: (row) => formatLabel(row.change_type) },
        ]}
      />
    </div>
  );
}

export function CompensationSection(props: ProfileSectionViewProps) {
  const data = props.data as { employee: Record<string, unknown> | null; message?: string } | null;
  if (!data) return <ProfileSectionPlaceholder title="Compensation" status="partial" />;

  return (
    <ProfilePlaceholderPanel
      title="Compensation"
      message={data.message ?? "Compensation details available to HR managers."}
    />
  );
}

export function BenefitsSection(props: ProfileSectionViewProps) {
  const data = props.data as { message?: string } | null;
  return (
    <ProfilePlaceholderPanel
      title="Benefits"
      message={
        data?.message ?? "Benefits enrollment integration ships in a future HR release."
      }
    />
  );
}

export function NotesSection(props: ProfileSectionViewProps) {
  const notes = (props.data as import("@/lib/platform/notes/types").PlatformNote[] | null) ?? [];
  return <ProfileNotesPanel notes={notes} title="Employee Notes" limit={50} />;
}
