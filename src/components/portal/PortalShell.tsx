"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalAccessibilityBar } from "./PortalAccessibilityBar";

const PARENT_NAV = [
  { href: "/portal", label: "Home" },
  { href: "/portal/messages", label: "Messages" },
  { href: "/portal/calendar", label: "Calendar" },
  { href: "/portal/progress", label: "Progress" },
  { href: "/portal/documents", label: "Documents" },
  { href: "/portal/finance", label: "Finance" },
  { href: "/portal/conferences", label: "Conferences" },
  { href: "/portal/forms", label: "Forms" },
  { href: "/portal/portfolio", label: "Portfolio" },
  { href: "/portal/notifications", label: "Notifications" },
  { href: "/portal/engagement", label: "Engagement" },
];

interface PortalShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
  mode: "parent" | "student";
  students?: { id: string; first_name: string; last_name: string }[];
  selectedStudentId?: string;
  unreadNotifications?: number;
}

export function PortalShell({
  children,
  userEmail,
  mode,
  students = [],
  selectedStudentId,
  unreadNotifications = 0,
}: PortalShellProps) {
  const pathname = usePathname();
  const nav = mode === "student"
    ? [
        { href: "/portal/student", label: "My Day" },
        { href: "/portal/student/schedule", label: "Schedule" },
        { href: "/portal/student/goals", label: "Goals" },
        { href: "/portal/messages", label: "Messages" },
      ]
    : PARENT_NAV;

  return (
    <div className="portal-root min-h-screen bg-slate-50 text-slate-900">
      <PortalAccessibilityBar />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <Link href={mode === "student" ? "/portal/student" : "/portal"} className="text-lg font-bold text-brand-700">
              AcademyOS Family Portal
            </Link>
            <p className="text-xs text-slate-500">
              {mode === "student" ? "Student experience" : "Parent & family experience"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {mode === "parent" && students.length > 1 && (
              <StudentSwitcher students={students} selectedStudentId={selectedStudentId} pathname={pathname} />
            )}
            <Link href="/apply/portal" className="text-slate-500 hover:text-brand-600">Admissions</Link>
            {userEmail && (
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 sm:inline">{userEmail}</span>
            )}
          </div>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2 sm:px-6" aria-label="Portal navigation">
          <ul className="flex gap-1">
            {nav.map((item) => {
              const active = pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href));
              const badge = item.href === "/portal/notifications" && unreadNotifications > 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      active ? "bg-brand-100 text-brand-800" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                    {badge && (
                      <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white">{unreadNotifications}</span>
                    )}
                  </Link>
                </li>
              );
            })}
            {mode === "parent" && (
              <li>
                <Link href="/portal/student" className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
                  Student view →
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function StudentSwitcher({
  students,
  selectedStudentId,
  pathname,
}: {
  students: { id: string; first_name: string; last_name: string }[];
  selectedStudentId?: string;
  pathname: string;
}) {
  const [value, setValue] = useState(selectedStudentId ?? students[0]?.id ?? "");

  useEffect(() => {
    if (selectedStudentId) setValue(selectedStudentId);
  }, [selectedStudentId]);

  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      Student
      <select
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (pathname.startsWith("/portal/students/")) {
            window.location.href = `/portal/students/${e.target.value}`;
          }
        }}
        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
      >
        <option value="">All children</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
        ))}
      </select>
    </label>
  );
}
