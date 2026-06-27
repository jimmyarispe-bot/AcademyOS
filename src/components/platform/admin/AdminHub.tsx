import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/cloud", label: "Cloud Console", desc: "Commercial SaaS — customers, billing, support, and operations", perm: "cloud.admin" },
  { href: "/dashboard/intelligence", label: "Intelligence Platform", desc: "AI readiness — prompts, providers, governance, and audit", perm: "ai.view" },
  { href: "/dashboard/data", label: "Enterprise Data Platform", desc: "Import, export, sync, mappings, and migration center", perm: "data.view" },
  { href: "/dashboard/certification/overview", label: "Certification Center", desc: "v1.0 launch readiness — testing, security, performance, and training", perm: "certification.view" },
  { href: "/dashboard/integrations", label: "Integration Hub", desc: "APIs, connectors, webhooks, sync, events, and developer portal", perm: "integration.view" },
  { href: "/dashboard/admin/configuration", label: "Configuration Studio", desc: "Organization builder, setup wizard, and go-live", perm: "configuration.view" },
  { href: "/dashboard/admin/organization", label: "Organization", desc: "Hierarchy, schools, campuses, programs", perm: "org.view" },
  { href: "/dashboard/admin/users", label: "Users & Access", desc: "Multi-school assignments and scopes", perm: "users.view" },
  { href: "/dashboard/admin/roles", label: "Roles & Permissions", desc: "RBAC matrix and custom roles", perm: "roles.view" },
  { href: "/dashboard/admin/schools", label: "School Configuration", desc: "Branding, colors, and settings", perm: "school.configure" },
  { href: "/dashboard/admin/directory", label: "Staff Directory", desc: "Enterprise staff directory", perm: "directory.view" },
  { href: "/dashboard/admin/security", label: "Security Dashboard", desc: "Audit, impersonation, and access logs", perm: "security.view" },
  { href: "/dashboard/admin/compliance", label: "Compliance Dashboard", desc: "FERPA, funding, certifications, approvals", perm: "compliance.view" },
  { href: "/dashboard/admin/approvals", label: "Approval Matrix", desc: "Executive approval thresholds", perm: "approvals.configure" },
  { href: "/dashboard/search", label: "Global Search", desc: "Permission-filtered enterprise search", perm: "search.global" },
  { href: "/dashboard/settings/preferences", label: "My Preferences", desc: "Theme, timezone, notifications", perm: null },
];

interface AdminHubProps {
  permissions: string[];
}

export function AdminHub({ permissions }: AdminHubProps) {
  const links = ADMIN_LINKS.filter((l) => !l.perm || permissions.includes(l.perm));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
        >
          <h3 className="font-semibold text-slate-900">{link.label}</h3>
          <p className="mt-1 text-sm text-slate-500">{link.desc}</p>
        </Link>
      ))}
    </div>
  );
}
