import { ProfileSectionPlaceholder } from "@/components/platform/profile-workspace/ProfileSectionPlaceholder";
import { getProfileSection } from "@/lib/platform/profile/registry";
import { loadProfileSectionComponent } from "@/lib/platform/profile/sections/register-module";
import type { ProfileSectionViewProps } from "@/lib/platform/profile/sections/types";
import type { ProfileEnvelopeBase } from "@/lib/platform/profile/types";

interface ProfileSectionRendererProps {
  profileKind: import("@/lib/platform/profile/types").ProfileKind;
  sectionKey: string;
  envelope: ProfileEnvelopeBase;
  data: unknown;
}

/** Renders the registered section component for a profile kind — shell-agnostic. */
export async function ProfileSectionRenderer({
  profileKind,
  sectionKey,
  envelope,
  data,
}: ProfileSectionRendererProps) {
  const section = getProfileSection(profileKind, sectionKey);
  const Component = await loadProfileSectionComponent(profileKind, sectionKey);

  if (!section || !Component) {
    return (
      <ProfileSectionPlaceholder
        title={sectionKey}
        status="placeholder"
        description="Section module is not registered."
      />
    );
  }

  if (section.status === "placeholder" && data == null) {
    return (
      <ProfileSectionPlaceholder
        title={section.label}
        status={section.status}
      />
    );
  }

  const props: ProfileSectionViewProps = {
    envelope,
    data,
    sectionKey,
  };

  return <Component {...props} />;
}
