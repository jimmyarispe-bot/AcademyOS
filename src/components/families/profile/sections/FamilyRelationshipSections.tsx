import Link from "next/link";
import { ProfileRelationshipsList } from "@/components/platform/profile-sections/ProfileRelationshipsList";
import { ProfileRecordTable } from "@/components/platform/profile-sections/ProfileRecordTable";
import {
  ProfileCard,
  ProfileEmpty,
  ProfileItem,
} from "@/components/platform/profile-workspace/ProfilePrimitives";
import type { ProfileSectionViewProps } from "@/lib/platform/profile/sections/types";
import type { PlatformRelationship } from "@/lib/platform/relationships/types";
import {
  campusName,
  formatLabel,
  latestEnrollment,
  missingSection,
} from "@/components/families/profile/sections/shared";
import { EmailLink } from "@/components/platform/contact/ContactLink";

export function HouseholdSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    family: Record<string, unknown> | null;
    households: Record<string, unknown>[];
  } | null;
  if (!data?.family) return missingSection("Household");

  return (
    <div className="space-y-6">
      <ProfileCard title="Primary Family Record">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileItem label="Family name" value={formatLabel(data.family.family_name)} />
          <ProfileItem label="Status" value={formatLabel(data.family.status)} />
          <ProfileItem label="Billing email" value={<EmailLink email={data.family.billing_email as string | null} />} />
          <ProfileItem label="Address" value={formatLabel(data.family.primary_address)} />
          <ProfileItem
            label="City / State"
            value={[data.family.city, data.family.state].filter(Boolean).join(", ") || "—"}
          />
        </dl>
      </ProfileCard>

      <ProfileRecordTable
        title="Household Addresses"
        records={data.households}
        emptyMessage="No household addresses on file"
        columns={[
          { key: "label", label: "Label" },
          { key: "address", label: "Address" },
          {
            key: "is_primary",
            label: "Primary",
            render: (row) => (row.is_primary ? "Yes" : "No"),
          },
          {
            key: "city",
            label: "Location",
            render: (row) =>
              [row.city, row.state, row.zip_code].filter(Boolean).join(", ") || "—",
          },
        ]}
      />
    </div>
  );
}

export function ParentsGuardiansSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    guardians: Record<string, unknown>[];
    relationships: PlatformRelationship[];
  } | null;
  if (!data) return missingSection("Parents / Guardians");

  return (
    <div className="space-y-6">
      <ProfileRecordTable
        title="Parents & Guardians"
        records={data.guardians}
        emptyMessage="No guardians linked to this household"
        columns={[
          {
            key: "name",
            label: "Name",
            render: (row) => `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(),
          },
          {
            key: "is_primary",
            label: "Role",
            render: (row) =>
              row.is_primary ? "Primary guardian" : formatLabel(row.relationship_to_student),
          },
          { key: "contact_type", label: "Contact type", render: (row) => formatLabel(row.contact_type) },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          {
            key: "user_id",
            label: "Portal",
            render: (row) => (row.user_id ? "Active account" : "No portal login"),
          },
          {
            key: "receives_billing",
            label: "Billing",
            render: (row) => (row.receives_billing ? "Receives billing" : "—"),
          },
          {
            key: "financial_responsibility_percent",
            label: "Responsibility %",
            render: (row) =>
              row.financial_responsibility_percent != null
                ? `${row.financial_responsibility_percent}%`
                : "—",
          },
        ]}
      />

      <ProfileRelationshipsList
        relationships={data.relationships}
        title="Platform Guardian Relationships (student.guardian)"
      />
    </div>
  );
}

export function StudentsSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    students: Record<string, unknown>[];
    relationships: PlatformRelationship[];
  } | null;
  if (!data) return missingSection("Students");

  return (
    <div className="space-y-6">
      {data.students.length === 0 ? (
        <ProfileCard title="Students">
          <ProfileEmpty>No students linked to this household</ProfileEmpty>
        </ProfileCard>
      ) : (
        <div className="space-y-4">
          {data.students.map((student) => (
            <ProfileCard
              key={String(student.id)}
              title={
                student.preferred_name
                  ? `${student.preferred_name} (${student.first_name} ${student.last_name})`
                  : `${student.first_name} ${student.last_name}`
              }
            >
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ProfileItem label="Enrollment" value={latestEnrollment(student)} />
                <ProfileItem label="Campus" value={campusName(student)} />
                <ProfileItem label="Grade" value={formatLabel(student.grade_level)} />
                <ProfileItem label="Program" value={formatLabel(student.program)} />
                <ProfileItem label="Lifecycle" value={formatLabel(student.lifecycle_stage)} />
                <ProfileItem label="Student #" value={formatLabel(student.student_number)} />
              </dl>
              <Link
                href={`/dashboard/students/${student.id}?section=overview`}
                className="mt-4 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Open student profile →
              </Link>
            </ProfileCard>
          ))}
        </div>
      )}

      <ProfileRelationshipsList
        relationships={data.relationships}
        title="Platform Student Relationships (student.family)"
      />
    </div>
  );
}
