import { ProfileRecordTable } from "@/components/platform/profile-sections/ProfileRecordTable";
import { ProfileRelationshipsList } from "@/components/platform/profile-sections/ProfileRelationshipsList";
import {
  ProfileCard,
  ProfileEmpty,
  ProfileItem,
} from "@/components/platform/profile-workspace/ProfilePrimitives";
import type { ProfileSectionViewProps } from "@/lib/platform/profile/sections/types";
import type { PlatformRelationship } from "@/lib/platform/relationships/types";
import {
  formatLabel,
  jsonList,
  missingSection,
  nestedName,
} from "@/components/families/profile/sections/shared";
import { PhoneLink } from "@/components/platform/contact/ContactLink";

const contactColumns = [
  {
    key: "name",
    label: "Contact",
    render: (row: Record<string, unknown>) => nestedName(row),
  },
  { key: "contact_type", label: "Type", render: (row: Record<string, unknown>) => formatLabel(row.contact_type) },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  {
    key: "student",
    label: "Student",
    render: (row: Record<string, unknown>) => nestedName(row),
  },
  {
    key: "custody_notes",
    label: "Notes",
    render: (row: Record<string, unknown>) => formatLabel(row.custody_notes),
  },
];

export function EmergencyContactsSection(props: ProfileSectionViewProps) {
  const data = props.data as { contacts: Record<string, unknown>[] } | null;
  if (!data) return missingSection("Emergency Contacts");

  return (
    <ProfileRecordTable
      title="Emergency Contacts"
      records={data.contacts}
      emptyMessage="No emergency contacts on file"
      columns={contactColumns}
    />
  );
}

export function AuthorizedPickupSection(props: ProfileSectionViewProps) {
  const data = props.data as { contacts: Record<string, unknown>[] } | null;
  if (!data) return missingSection("Authorized Pickup");

  return (
    <ProfileRecordTable
      title="Authorized Pickup"
      records={data.contacts}
      emptyMessage="No authorized pickup contacts on file"
      columns={[
        ...contactColumns,
        {
          key: "can_pick_up",
          label: "Pickup",
          render: () => "Authorized",
        },
      ]}
    />
  );
}

export function TransportationSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    routes: PlatformRelationship[];
    pickupContacts: Record<string, unknown>[];
    emergencyContacts: Record<string, unknown>[];
  } | null;
  if (!data) return missingSection("Transportation", "partial");

  return (
    <div className="space-y-6">
      <ProfileRelationshipsList
        relationships={data.routes}
        title="Transportation Routes (student.transportation_route)"
      />

      <ProfileRecordTable
        title="Pickup Authorization"
        records={data.pickupContacts}
        emptyMessage="No pickup authorizations on file"
        columns={contactColumns}
      />

      <ProfileRecordTable
        title="Transportation Emergency Contacts"
        records={data.emergencyContacts}
        emptyMessage="No transportation emergency contacts on file"
        columns={contactColumns}
      />
    </div>
  );
}

export function MedicalSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    profiles: { student: Record<string, unknown>; medical: Record<string, unknown> }[];
  } | null;
  if (!data) return missingSection("Medical", "partial");

  if (data.profiles.length === 0) {
    return (
      <ProfileCard title="Medical">
        <ProfileEmpty>No medical profiles on file for household students</ProfileEmpty>
      </ProfileCard>
    );
  }

  return (
    <div className="space-y-6">
      {data.profiles.map(({ student, medical }) => (
        <ProfileCard
          key={String(student.id)}
          title={`${student.first_name} ${student.last_name} — Medical`}
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <ProfileItem label="Allergies" value={jsonList(medical.allergies)} />
            <ProfileItem label="Medications" value={jsonList(medical.medications)} />
            <ProfileItem label="Diagnoses" value={jsonList(medical.diagnoses)} />
            <ProfileItem label="Physician" value={formatLabel(medical.physician_name)} />
            <ProfileItem label="Physician phone" value={<PhoneLink phone={medical.physician_phone as string | null} />} />
            <ProfileItem label="Insurance" value={formatLabel(medical.insurance_carrier)} />
            <ProfileItem
              label="Emergency medical plan"
              value={formatLabel(medical.emergency_medical_plan)}
            />
            <ProfileItem label="Seizure plan" value={formatLabel(medical.seizure_plan)} />
            <ProfileItem label="Diabetes plan" value={formatLabel(medical.diabetes_plan)} />
            <ProfileItem label="Health alerts" value={jsonList(medical.health_alerts)} />
          </dl>
        </ProfileCard>
      ))}
    </div>
  );
}
