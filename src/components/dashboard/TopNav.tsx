"use client";

import { createClient } from "@/lib/supabase/client";
import { getModuleByPath } from "@/lib/dashboard/navigation";
import { StaffNotificationsBell } from "@/components/admissions/StaffNotificationsBell";
import { usePathname, useRouter } from "next/navigation";

interface TopNavProps {
  fullName: string;
  roleLabel: string;
  notifications?: Array<{
    id: string;
    title: string;
    body: string;
    lead_id: string | null;
    created_at: string;
    notification_type: string;
  }>;
  onMenuClick: () => void;
}

export function TopNav({ fullName, roleLabel, notifications = [], onMenuClick }: TopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentModule = getModuleByPath(pathname);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 lg:hidden"
          aria-label="Open navigation menu"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
            {currentModule.pageTitle}
          </h1>
          <p className="hidden text-sm text-slate-500 sm:block">
            {currentModule.pageSubtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <StaffNotificationsBell notifications={notifications} />
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 py-1.5 pl-1.5 pr-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-slate-900">
              {fullName}
            </p>
            <p className="truncate text-xs text-slate-500">{roleLabel}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out of AcademyOS"
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
