"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  getBrandedDashboardModules,
  isModuleActive,
} from "@/lib/dashboard/navigation";
import { visibleModules } from "@/lib/dashboard/module-visibility";
import { FOUNDER_DASHBOARD_NAV, FOUNDERS_UTILITY_NAV } from "@/lib/dashboard/founders-navigation";
import { EXECUTIVE_DIRECTOR_DASHBOARD_NAV } from "@/lib/dashboard/executive-director-dashboard";
import { useBranding } from "@/components/branding/BrandingContext";
import { OrganizationName } from "@/components/branding/OrganizationName";
import { formatWorkspaceProductLine } from "@/lib/branding/workspace-edition";
import { cn } from "@/components/workspace-design-system/utils";
import { ModuleIcon } from "./ModuleIcons";
import {
  SIDEBAR_NAV_SECTIONS,
  isSidebarItemActive,
  visibleSectionItems,
} from "@/lib/dashboard/intelligence-navigation";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  /** Founder-only nav — never pass true for non-FOUNDER roles. */
  isFounder?: boolean;
  /** Executive Director operating nav — never shows Founder widgets. */
  isExecutiveDirector?: boolean;
  roleLabel?: string;
  /**
   * Effective permission keys for the signed-in user. Executive and
   * Intelligence links are drawn only when the role can actually open them —
   * a menu that shows unopenable links reads as a broken platform.
   */
  permissions?: readonly string[];
}

function isPlatformActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/dashboard/admin") return pathname.startsWith("/dashboard/admin");
  if (href === "/exec/graph") return pathname.startsWith("/exec/graph");
  if (href === "/exec/brief") return pathname.startsWith("/exec/brief");
  return pathname.startsWith(href);
}

const navLinkClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
    active
      ? "bg-brand-600 text-white shadow-sm"
      : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
  );

export function Sidebar({
  open,
  onClose,
  isFounder = false,
  isExecutiveDirector = false,
  roleLabel,
  permissions = [],
}: SidebarProps) {
  const pathname = usePathname();
  const branding = useBranding();
  const navSections = SIDEBAR_NAV_SECTIONS.map((section) => ({
    ...section,
    items: visibleSectionItems(section, permissions),
  })).filter((section) => section.items.length > 0);
  // The Modules list used to render every entry to everybody, so an admissions
  // School Leader saw Scholarships and Finance in her sidebar and was bounced
  // only after clicking. See lib/dashboard/module-visibility.
  const modules = visibleModules(getBrandedDashboardModules(branding), permissions).map((module) =>
    !isFounder && module.id === "executive"
      ? {
          ...module,
          sidebarLabel: isExecutiveDirector ? "Executive Director" : "Home",
          pageTitle: isExecutiveDirector ? "Executive Director" : "Home",
          pageSubtitle: isExecutiveDirector
            ? "School operations command center"
            : "Your AcademyOS workspace",
        }
      : module
  );
  // Dark logo first — this mark sits on the navy sidebar. Empty string is the
  // "not configured" value the branding resolver returns, so trim before
  // deciding, or a stray space renders a broken image.
  const brandMarkUrl =
    branding.darkLogoUrl?.trim() || branding.logoUrl?.trim() || "";

  const footerTagline = formatWorkspaceProductLine({
    branding,
    isFounder,
    isExecutiveDirector,
    roleLabel,
  });
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onCloseRef.current();
  }, [pathname]);

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-y-0 right-0 left-72 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "flex w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:transition-transform max-lg:duration-200",
          open
            ? "max-lg:translate-x-0"
            : "max-lg:pointer-events-none max-lg:-translate-x-full",
          "lg:relative"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          {/* The organization's own mark when it has one, the monogram when it
              does not. `logo_url` and `dark_logo_url` were collected by
              /dashboard/admin/branding and read by nothing at all, so every
              subscriber got a letter in a coloured square whatever they
              uploaded.

              The dark logo is preferred because this sits on the navy sidebar.
              A white background is painted behind it: most school logos are
              drawn for white and disappear on dark, and a mark nobody can see
              is worse than the letter it replaced. */}
          {brandMarkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brandMarkUrl}
              alt={branding.organizationName}
              className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              {branding.monogram}
            </div>
          )}
          <div>
            {/* tone="light" deliberately: the network's dark blue is
                unreadable on the navy sidebar. Routed through the same
                component so this stays a considered exception rather than a
                place somebody forgot. */}
            <p className="text-sm font-semibold">
              <OrganizationName name={branding.productName} tone="light" />
            </p>
            <p className="text-xs text-slate-400">{branding.productTagline}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Modules
          </p>
          <ul className="space-y-1">
            {modules.map((module) => {
              const active = isModuleActive(pathname, module);
              return (
                <li key={module.id}>
                  <Link href={module.href} className={navLinkClass(active)}>
                    <ModuleIcon moduleId={module.id} />
                    {module.sidebarLabel}
                  </Link>
                </li>
              );
            })}
          </ul>

          {navSections.map((section) => (
            <div key={section.id} className="mt-6">
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={navLinkClass(isSidebarItemActive(pathname, item))}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-4">
          {isFounder && (
            <>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Founder
              </p>
              {FOUNDER_DASHBOARD_NAV.map((item, index) => {
                const active = isPlatformActive(
                  pathname,
                  item.href,
                  "exact" in item ? item.exact : false
                );
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className={cn(index > 0 && "mt-1", navLinkClass(active))}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
          {isExecutiveDirector && !isFounder && (
            <>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Executive Director
              </p>
              {EXECUTIVE_DIRECTOR_DASHBOARD_NAV.map((item, index) => {
                const active = isPlatformActive(pathname, item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(index > 0 && "mt-1", navLinkClass(active))}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
          <p
            className={cn(
              "mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500",
              (isFounder || isExecutiveDirector) && "mt-4"
            )}
          >
            Account
          </p>
          {FOUNDERS_UTILITY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("mt-1", navLinkClass(pathname.startsWith(item.href)))}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="border-t border-sidebar-border p-4">
          <p className="text-xs text-slate-500">{footerTagline}</p>
        </div>
      </aside>
    </>
  );
}
