import type { OrganizationBranding } from "@/lib/branding/types";
import {
  FOUNDERS_QUICK_LAUNCH_MODULE_IDS,
  getFoundersModuleLabels,
} from "@/lib/dashboard/founders-navigation";
import { getAcademyNavigationService } from "@/applications/academyos/navigation";
import { getJagNavigationService } from "@/jag/navigation";

export type ModuleId =
  | "executive"
  | "admissions"
  | "students"
  | "families"
  | "communications"
  | "workflows"
  | "calendar"
  | "documents"
  | "scheduling"
  | "teacher"
  | "school-leader"
  | "scholarships"
  | "finance"
  | "hr";

export interface DashboardModule {
  id: ModuleId;
  href: string;
  sidebarLabel: string;
  pageTitle: string;
  pageSubtitle: string;
  placeholderTitle: string;
  placeholderDescription: string;
  placeholderFeatures: string[];
}

export const DASHBOARD_MODULES: DashboardModule[] = [
  {
    id: "executive",
    href: "/dashboard",
    sidebarLabel: "Founder Morning Brief",
    pageTitle: "Founder Morning Brief",
    pageSubtitle: "Daily operating snapshot and quick actions",
    placeholderTitle: "",
    placeholderDescription: "",
    placeholderFeatures: [],
  },
  {
    id: "admissions",
    href: "/dashboard/admissions",
    sidebarLabel: "Admissions",
    pageTitle: "Admissions CRM",
    pageSubtitle: "Manage inquiries, tours, and applications",
    placeholderTitle: "Admissions CRM",
    placeholderDescription:
      "Track prospects through every stage of the enrollment funnel — from first inquiry to accepted enrollment.",
    placeholderFeatures: [
      "Prospect pipeline and status tracking",
      "Tour scheduling and follow-ups",
      "Application review workflows",
      "Guardian communication history",
    ],
  },
  {
    id: "students",
    href: "/dashboard/students",
    sidebarLabel: "Student Success",
    pageTitle: "Student Success (SSIS)",
    pageSubtitle: "Unified student success profiles from acceptance through graduation",
    placeholderTitle: "Student Success Platform",
    placeholderDescription:
      "Every academic, behavioral, financial, medical, and operational record connected to one student profile.",
    placeholderFeatures: [
      "Student Success Score and executive summary",
      "Admissions-linked conversion with no duplicate entry",
      "Funding, scholarships, and state funding center",
      "Communication timeline and parent engagement",
    ],
  },
  {
    id: "families",
    href: "/dashboard/families",
    sidebarLabel: "Families",
    pageTitle: "Family Management",
    pageSubtitle: "Households, guardians, siblings, and communications",
    placeholderTitle: "Family Management",
    placeholderDescription:
      "First-class family profiles connecting students, guardians and siblings. Billing lives in Finance, behind its own permission.",
    placeholderFeatures: [
      "Family dashboard with search and filters",
      "Multi-guardian household management",
      "Merge and split families with audit history",
      "Household communications and contact history",
    ],
  },
  {
    id: "communications",
    href: "/dashboard/communications",
    sidebarLabel: "Communications",
    pageTitle: "Communications",
    pageSubtitle: "Email, SMS, portal messages, calls, meetings, and announcements",
    placeholderTitle: "Communications & Engagement",
    placeholderDescription:
      "Centralized communication center with templates, scheduling, and audit trail.",
    placeholderFeatures: [
      "Unified inbox across channels",
      "Templates with merge variables",
      "Announcements and scheduled messages",
      "Phone call and meeting logs",
    ],
  },
  {
    id: "workflows",
    href: "/dashboard/workflows",
    sidebarLabel: "Workflows",
    pageTitle: "Workflows & Automation",
    pageSubtitle: "Event-driven workflows, conditions, actions, and execution history",
    placeholderTitle: "Workflow Engine",
    placeholderDescription:
      "Configure automations that respond to admissions, students, billing, and more.",
    placeholderFeatures: [
      "Trigger library across all modules",
      "Condition and action builder",
      "Visual workflow definitions",
      "Execution history with retry",
    ],
  },
  {
    id: "calendar",
    href: "/dashboard/calendar",
    sidebarLabel: "Calendar",
    pageTitle: "Calendar",
    pageSubtitle: "Classes, meetings, resources, and school-wide schedules",
    placeholderTitle: "Calendar Platform",
    placeholderDescription:
      "Unified day/week/month calendar with recurrence, availability, and resource booking.",
    placeholderFeatures: [
      "Day, week, month, and agenda views",
      "Recurring events with exceptions",
      "Teacher and student conflict prevention",
      "Resource reservations and Meet adapters",
    ],
  },
  {
    id: "documents",
    href: "/dashboard/documents",
    sidebarLabel: "Documents",
    pageTitle: "Documents & Records",
    pageSubtitle: "Versioned records with permissions, templates, and lifecycle management",
    placeholderTitle: "Document & Records Management",
    placeholderDescription:
      "First-class documents with version control, entity relationships, and workflow integration.",
    placeholderFeatures: [
      "Student, family, employee, and school document views",
      "Immutable version history with restore",
      "Templates and archive/restore/delete lifecycle",
      "Workflow and Executive Intelligence events",
    ],
  },
  {
    id: "scheduling",
    href: "/dashboard/scheduling",
    sidebarLabel: "Scheduling",
    pageTitle: "Academic Operations",
    pageSubtitle: "Calendars, sections, sessions, therapy, and Academy Way scheduling",
    placeholderTitle: "Academic Operations & Scheduling",
    placeholderDescription:
      "Enterprise scheduling engine for virtual, hybrid, and campus instruction with SSIS and Mission Control integration.",
    placeholderFeatures: [
      "Master academic calendars with holiday sync",
      "Session generator with Academy Way rules",
      "Teacher workload and conflict intelligence",
      "SSIS attendance bridge and Google Meet links",
    ],
  },
  {
    id: "teacher",
    href: "/dashboard/teacher",
    sidebarLabel: "Teacher Studio",
    pageTitle: "Teacher Studio",
    pageSubtitle: "Daily instructional hub — schedule, sessions, progress, and compliance",
    placeholderTitle: "Teacher Workspace",
    placeholderDescription:
      "Everything instructional staff need for the current day in one workspace.",
    placeholderFeatures: [
      "My Day dashboard with session alerts",
      "Instructional session workspace",
      "Academy Way progress and Structured Literacy",
      "Compliance and Mission Control integration",
    ],
  },
  {
    id: "school-leader",
    href: "/dashboard/school-leader",
    sidebarLabel: "School Leader",
    pageTitle: "School Leader Workspace",
    pageSubtitle: "Campus operations — enrollment, academics, compliance, and finance summaries",
    placeholderTitle: "School Leader Workspace",
    placeholderDescription:
      "Operational hub for school leaders over existing platform services.",
    placeholderFeatures: [
      "Campus overview and alerts",
      "Enrollment and student oversight",
      "Academics via Learning Intelligence",
      "Read-only finance and HR summaries",
    ],
  },
  {
    id: "scholarships",
    href: "/dashboard/scholarships",
    sidebarLabel: "Scholarships",
    pageTitle: "Scholarships",
    pageSubtitle: "Review and approve financial aid",
    placeholderTitle: "Scholarship Management",
    placeholderDescription:
      "Manage scholarship applications, award decisions, and financial aid documentation.",
    placeholderFeatures: [
      "Application intake and review",
      "Award amount approvals",
      "Document verification",
      "Financial aid reporting",
    ],
  },
  {
    id: "finance",
    href: "/dashboard/finance",
    sidebarLabel: "Finance",
    pageTitle: "Finance",
    pageSubtitle: "Tuition, billing, and revenue reporting",
    placeholderTitle: "Finance & Billing",
    placeholderDescription:
      "Monitor tuition revenue, billing cycles, and financial performance across your organization.",
    placeholderFeatures: [
      "Tuition and fee management",
      "Invoice generation and tracking",
      "Revenue dashboards",
      "Payment reconciliation",
    ],
  },
  {
    id: "hr",
    href: "/dashboard/hr",
    sidebarLabel: "Workforce",
    pageTitle: "Human Capital & Workforce",
    pageSubtitle: "Recruiting, credentials, payroll, compliance, and analytics",
    placeholderTitle: "Human Capital & Workforce",
    placeholderDescription:
      "Manage the complete employee lifecycle from recruiting through separation.",
    placeholderFeatures: [
      "Applicant tracking and hiring workflows",
      "Credentials, onboarding, and compliance center",
      "Time, leave, payroll preparation, and analytics",
      "Substitute and volunteer management",
    ],
  },
];

export const EXECUTIVE_MODULE = DASHBOARD_MODULES[0];

export const QUICK_LAUNCH_MODULES: DashboardModule[] = FOUNDERS_QUICK_LAUNCH_MODULE_IDS.map(
  (id) => DASHBOARD_MODULES.find((m) => m.id === id)!
);

export function applyBrandingToModule(
  module: DashboardModule,
  branding: OrganizationBranding
): DashboardModule {
  const labels = getFoundersModuleLabels(branding);
  const sidebarLabel = labels[module.id as keyof typeof labels] ?? module.sidebarLabel;
  if (module.id === "executive") {
    return {
      ...module,
      sidebarLabel,
      pageTitle: branding.founderWorkspaceLabel,
      pageSubtitle: "Daily operating snapshot and quick actions",
    };
  }
  return { ...module, sidebarLabel, pageTitle: sidebarLabel };
}

/**
 * Staff sidebar modules — JAG Navigation Service owns assembly.
 * Application packages contribute definitions; presentation metadata stays in DASHBOARD_MODULES.
 */
export function getBrandedDashboardModules(branding: OrganizationBranding): DashboardModule[] {
  const jagModules = getJagNavigationService().listStaffModules();
  // Client / pre-boot fallback: Academy package static definition (configuration only).
  const staffModules =
    jagModules.length > 0
      ? jagModules
      : getAcademyNavigationService()
          .listStaffModules()
          .map((m) => ({ ...m, applicationId: "academyos" as const }));

  const byId = new Map(DASHBOARD_MODULES.map((module) => [module.id, module]));

  const fromNav = staffModules
    .map((item) => {
      const base = byId.get(item.id as ModuleId);
      if (!base) return null;
      return applyBrandingToModule(
        {
          ...base,
          href: item.href,
          sidebarLabel: item.label || base.sidebarLabel,
        },
        branding
      );
    })
    .filter((module): module is DashboardModule => module != null);

  if (!fromNav.length) {
    return DASHBOARD_MODULES.map((module) => applyBrandingToModule(module, branding));
  }

  return fromNav;
}

export function getModuleByPath(pathname: string, branding?: OrganizationBranding): DashboardModule {
  if (pathname === "/dashboard") {
    return branding ? applyBrandingToModule(EXECUTIVE_MODULE, branding) : EXECUTIVE_MODULE;
  }

  if (pathname.startsWith("/dashboard/mission-control")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: branding?.missionControlLabel ?? "Mission Control",
      pageSubtitle: "Cross-module operations and alerts",
    };
  }

  if (pathname.startsWith("/dashboard/automation/marketplace")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Workflow Marketplace",
      pageSubtitle: "Reusable automation templates",
    };
  }

  if (pathname.startsWith("/dashboard/admin/configuration") || pathname.startsWith("/dashboard/admin/setup") || pathname.startsWith("/dashboard/admin/go-live") || pathname.startsWith("/dashboard/admin/modules") || pathname.startsWith("/dashboard/admin/branding") || pathname.startsWith("/dashboard/admin/campuses") || pathname.startsWith("/dashboard/admin/programs") || pathname.startsWith("/dashboard/admin/calendars") || pathname.startsWith("/dashboard/admin/academic") || pathname.startsWith("/dashboard/admin/workflows") || pathname.startsWith("/dashboard/admin/playbooks") || pathname.startsWith("/dashboard/admin/communications") || pathname.startsWith("/dashboard/admin/templates") || pathname.startsWith("/dashboard/admin/integrations")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Configuration Studio",
      pageSubtitle: "Organization builder — configure your platform without code",
    };
  }

  if (pathname.startsWith("/dashboard/admin/admissions") || pathname.startsWith("/dashboard/admin/finance") || pathname.startsWith("/dashboard/admin/hr")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Configuration Studio",
      pageSubtitle: "Module configuration settings",
    };
  }

  if (pathname.startsWith("/dashboard/admin")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Administration",
      pageSubtitle: "Identity, organizations, and permissions",
    };
  }

  if (pathname.startsWith("/dashboard/settings")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "My Preferences",
      pageSubtitle: "Personal settings and notifications",
    };
  }

  if (pathname.startsWith("/dashboard/compliance")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Enterprise Compliance Center",
      pageSubtitle: "Obligations, deadlines, renewals, and compliance activity",
    };
  }

  if (pathname.startsWith("/dashboard/founder")) {
    return {
      ...EXECUTIVE_MODULE,
      href: "/dashboard/founder",
      sidebarLabel: "Founder Intelligence",
      pageTitle: "Founder Intelligence",
      pageSubtitle: "AI executive layer — brief, health, risks, decisions",
    };
  }

  if (pathname.startsWith("/dashboard/executive")) {
    return branding
      ? {
          ...EXECUTIVE_MODULE,
          pageTitle: branding.intelligenceEngineLabel,
          pageSubtitle: "Decision support, forecasting, risk, and board reporting",
        }
      : {
          ...EXECUTIVE_MODULE,
          pageTitle: "Executive Intelligence",
          pageSubtitle: "Decision support, forecasting, risk, and board reporting",
        };
  }

  if (pathname.startsWith("/dashboard/employee")) {
    return {
      ...DASHBOARD_MODULES.find((m) => m.id === "hr")!,
      pageTitle: "Employee Portal",
      pageSubtitle: "Schedules, leave, training, and self-service",
    };
  }

  if (pathname.startsWith("/dashboard/search")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Global Search",
      pageSubtitle: "Permission-filtered enterprise search",
    };
  }

  if (
    pathname.startsWith("/dashboard/admissions/automation") ||
    pathname.startsWith("/dashboard/admissions/workflows")
  ) {
    return {
      ...DASHBOARD_MODULES.find((m) => m.id === "admissions")!,
      pageTitle: pathname.includes("workflows") ? "Workflow Builder" : "Automation Dashboard",
      pageSubtitle: "Enterprise automation engine",
    };
  }

  if (pathname.startsWith("/dashboard/finance/intelligence")) {
    return {
      ...DASHBOARD_MODULES.find((m) => m.id === "finance")!,
      pageTitle: "Financial Intelligence",
      pageSubtitle: "Profitability, forecasting, scenarios, and executive analytics",
    };
  }

  if (pathname.startsWith("/dashboard/data")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Enterprise Data Platform",
      pageSubtitle: "Import, export, sync, validate, archive, and analyze data across every module",
    };
  }

  if (pathname.startsWith("/dashboard/intelligence")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Enterprise Intelligence Platform",
      pageSubtitle: "AI readiness framework — governance, orchestration, and extensibility",
    };
  }

  if (pathname.startsWith("/cloud")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: branding ? `${branding.productName} Cloud` : "Cloud Console",
      pageSubtitle: "Commercial SaaS — customers, subscriptions, support, and operations",
    };
  }

  if (pathname.startsWith("/dashboard/certification")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Certification Center",
      pageSubtitle: "Version 1.0 launch readiness — testing, security, performance, and compliance",
    };
  }

  if (pathname.startsWith("/dashboard/integrations")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Integration Hub",
      pageSubtitle: "Enterprise integration platform — APIs, connectors, webhooks, sync, and events",
    };
  }

  const resolved =
    DASHBOARD_MODULES.find(
      (module) => module.id !== "executive" && pathname.startsWith(module.href)
    ) ?? EXECUTIVE_MODULE;

  return branding ? applyBrandingToModule(resolved, branding) : resolved;
}

export function isModuleActive(pathname: string, module: DashboardModule): boolean {
  if (module.id === "executive") {
    return pathname === "/dashboard";
  }
  return pathname.startsWith(module.href);
}
