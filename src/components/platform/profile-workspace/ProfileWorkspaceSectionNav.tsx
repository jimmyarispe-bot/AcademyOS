"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { ClientProfileNavigation } from "@/lib/platform/profile/types";

const ProfileSectionNavOverflow = dynamic(
  () =>
    import("@/components/platform/profile-workspace/ProfileSectionNavOverflow").then(
      (module) => ({ default: module.ProfileSectionNavOverflow })
    ),
  { ssr: true }
);

interface ProfileWorkspaceSectionNavProps {
  /** Must be client-safe (no loadData). Use toClientProfileNavigation(). */
  navigation: ClientProfileNavigation;
  /** Flat list of primary tabs for horizontal nav */
  compact?: boolean;
}

export function ProfileWorkspaceSectionNav({
  navigation,
  compact = false,
}: ProfileWorkspaceSectionNavProps) {
  const primary = [
    ...navigation.pinned,
    ...navigation.groups.flatMap((g) => g.sections),
  ].filter((s) => s.visible);

  if (!primary.length && !navigation.overflow.length) return null;

  return (
    <nav className="space-y-3" aria-label="Profile sections">
      {/* Wraps rather than scrolls.

          A horizontally scrolling tab strip hides the sections nobody has
          scrolled to, and there is no visual difference between "that is all of
          them" and "there are four more past the right edge". Staff found
          sections by knowing they existed, which is not finding them.

          Wrapping costs a second row of vertical space and shows everything. */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-50 p-1">
        {primary.map((section) => {
          const active = navigation.activeSection === section.key;
          return (
            <Link
              key={section.key}
              href={section.href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {section.label}
              {section.status === "placeholder" && (
                <span className="ml-1.5 text-[10px] uppercase text-slate-400">Soon</span>
              )}
            </Link>
          );
        })}

        <ProfileSectionNavOverflow
          overflowGroups={navigation.overflowGroups}
          activeSection={navigation.activeSection}
        />
      </div>

      {!compact && navigation.groups.length > 0 && (
        <div className="hidden flex-wrap gap-2 xl:flex">
          {navigation.groups.map((group) => (
            <div
              key={group.group}
              className="rounded-lg border border-slate-100 bg-white px-3 py-1.5 text-xs text-slate-500"
            >
              <span className="font-medium text-slate-700">{group.label}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              {group.sections.map((s, i) => (
                <span key={s.key}>
                  {i > 0 && ", "}
                  <Link
                    href={s.href}
                    className={
                      navigation.activeSection === s.key
                        ? "font-medium text-brand-600"
                        : "hover:text-brand-600"
                    }
                  >
                    {s.label}
                  </Link>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
