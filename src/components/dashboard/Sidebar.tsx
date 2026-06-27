"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DASHBOARD_MODULES,
  isModuleActive,
} from "@/lib/dashboard/navigation";
import { ModuleIcon } from "./ModuleIcons";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            A
          </div>
          <div>
            <p className="text-sm font-semibold text-white">AcademyOS</p>
            <p className="text-xs text-slate-400">Education ERP</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Modules
          </p>
          <ul className="space-y-1">
            {DASHBOARD_MODULES.map((module) => {
              const active = isModuleActive(pathname, module);
              return (
                <li key={module.id}>
                  <Link
                    href={module.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-600 text-white shadow-sm"
                        : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
                    }`}
                  >
                    <ModuleIcon moduleId={module.id} />
                    {module.sidebarLabel}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Platform
          </p>
          <Link
            href="/dashboard/mission-control"
            onClick={onClose}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/mission-control")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Mission Control
          </Link>
          <Link
            href="/dashboard/executive"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/executive")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Executive Intelligence
          </Link>
          <Link
            href="/dashboard/compliance"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/compliance")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Compliance Center
          </Link>
          <Link
            href="/dashboard/work"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/work") ||
              pathname.startsWith("/dashboard/projects") ||
              pathname.startsWith("/dashboard/tasks") ||
              pathname.startsWith("/dashboard/playbooks") ||
              pathname.startsWith("/dashboard/workload")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Work Management
          </Link>
          <Link
            href="/dashboard/automation/marketplace"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/automation/marketplace")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Workflow Marketplace
          </Link>
          <Link
            href="/dashboard/finance/intelligence"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/finance/intelligence")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Financial Intelligence
          </Link>
          <Link
            href="/dashboard/network"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/network")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Intelligence Network
          </Link>
          <Link
            href="/operations"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/operations")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Operations Center
          </Link>
          <Link
            href="/cloud"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/cloud")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Cloud Console
          </Link>
          <Link
            href="/dashboard/intelligence"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/intelligence")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Intelligence Platform
          </Link>
          <Link
            href="/dashboard/data"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/data")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Data Platform
          </Link>
          <Link
            href="/dashboard/certification/overview"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/certification")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Certification Center
          </Link>
          <Link
            href="/dashboard/integrations"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/integrations")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Integration Hub
          </Link>
          <Link
            href="/dashboard/admin"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/admin")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Administration
          </Link>
          <Link
            href="/dashboard/search"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/search")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Global Search
          </Link>
          <Link
            href="/dashboard/settings/preferences"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            My Preferences
          </Link>
          <Link
            href="/dashboard/employee"
            onClick={onClose}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/employee")
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            Employee Portal
          </Link>
        </div>

        <div className="border-t border-sidebar-border p-4">
          <p className="text-xs text-slate-500">
            AcademyOS — Education Operating System
          </p>
        </div>
      </aside>
    </>
  );
}
