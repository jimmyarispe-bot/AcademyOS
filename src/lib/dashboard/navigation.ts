export type ModuleId =
  | "executive"
  | "admissions"
  | "students"
  | "scheduling"
  | "teacher"
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
    sidebarLabel: "Executive Home",
    pageTitle: "Executive Home",
    pageSubtitle: "Organization overview and quick actions",
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
    sidebarLabel: "Teacher Workspace",
    pageTitle: "Teacher Workspace",
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

export const QUICK_LAUNCH_MODULES: DashboardModule[] = [
  DASHBOARD_MODULES.find((m) => m.id === "admissions")!,
  DASHBOARD_MODULES.find((m) => m.id === "students")!,
  DASHBOARD_MODULES.find((m) => m.id === "scheduling")!,
  DASHBOARD_MODULES.find((m) => m.id === "teacher")!,
  DASHBOARD_MODULES.find((m) => m.id === "scholarships")!,
  DASHBOARD_MODULES.find((m) => m.id === "finance")!,
  DASHBOARD_MODULES.find((m) => m.id === "hr")!,
  EXECUTIVE_MODULE,
];

export function getModuleByPath(pathname: string): DashboardModule {
  if (pathname === "/dashboard") {
    return EXECUTIVE_MODULE;
  }

  if (pathname.startsWith("/dashboard/mission-control")) {
    return {
      ...EXECUTIVE_MODULE,
      pageTitle: "Mission Control",
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
      pageSubtitle: "Organization builder — configure AcademyOS without code",
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

  if (pathname.startsWith("/dashboard/executive")) {
    return {
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
      pageTitle: "AcademyOS Cloud Console",
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

  return (
    DASHBOARD_MODULES.find(
      (module) => module.id !== "executive" && pathname.startsWith(module.href)
    ) ?? EXECUTIVE_MODULE
  );
}

export function isModuleActive(pathname: string, module: DashboardModule): boolean {
  if (module.id === "executive") {
    return pathname === "/dashboard";
  }
  return pathname.startsWith(module.href);
}
