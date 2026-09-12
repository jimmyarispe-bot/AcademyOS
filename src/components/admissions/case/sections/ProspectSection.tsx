import {
  ProfileCard,
  ProfileItem,
} from "@/components/platform/profile-workspace/ProfilePrimitives";
import type { ProfileSectionViewProps } from "@/lib/platform/profile/sections/types";
import { missing } from "./shared";
import { EmailLink, PhoneLink } from "@/components/platform/contact/ContactLink";

export function ProspectSection(props: ProfileSectionViewProps) {
  const data = props.data as {
    lead: Record<string, unknown>;
    guardians: Record<string, unknown>[];
  } | null;
  if (!data) return missing("Prospective Family");

  const lead = data.lead;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ProfileCard title="Prospective Student">
        <div className="space-y-2 text-sm">
          <ProfileItem
            label="Name"
            value={`${lead.first_name} ${lead.last_name}`}
          />
          {Boolean(lead.preferred_name) && (
            <ProfileItem label="Preferred" value={String(lead.preferred_name)} />
          )}
          {Boolean(lead.program) && (
            <ProfileItem label="Program" value={String(lead.program)} />
          )}
          {Boolean(lead.applying_for_grade) && (
            <ProfileItem label="Applying for" value={String(lead.applying_for_grade)} />
          )}
        </div>
      </ProfileCard>
      <ProfileCard title="Primary Guardian">
        <div className="space-y-2 text-sm">
          <ProfileItem
            label="Name"
            value={`${lead.guardian_first_name ?? ""} ${lead.guardian_last_name ?? ""}`.trim() || "—"}
          />
          {Boolean(lead.guardian_email) && (
            <ProfileItem label="Email" value={<EmailLink email={String(lead.guardian_email)} />} />
          )}
          {Boolean(lead.guardian_phone) && (
            <ProfileItem label="Phone" value={<PhoneLink phone={String(lead.guardian_phone)} />} />
          )}
        </div>
      </ProfileCard>
      {data.guardians.length > 0 && (
        <ProfileCard title="Additional Guardians">
          <ul className="space-y-2 text-sm">
            {data.guardians.map((g) => (
              <li key={String(g.id)} className="rounded-lg bg-slate-50 px-3 py-2">
                {String(g.first_name)} {String(g.last_name)}
              </li>
            ))}
          </ul>
        </ProfileCard>
      )}
    </div>
  );
}
