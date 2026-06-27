export type CertStatus = "pass" | "warning" | "failure" | "pending" | "skipped";
export type IntegrationStatus = "healthy" | "warning" | "failure";
export type TrafficLight = "green" | "yellow" | "red";

export interface ReadinessScores {
  overall: number;
  security: number;
  performance: number;
  accessibility: number;
  mobile: number;
  pwa: number;
  testing: number;
  integration: number;
  documentation: number;
  dr: number;
  cloud: number;
  training: number;
  support: number;
  operational: number;
  isV1Certified: boolean;
}

export interface WorkflowTestDefinition {
  key: string;
  name: string;
  modules: string[];
  table?: string;
}

export const CERT_NAV = [
  { href: "/dashboard/certification/overview", label: "Overview", exact: true as const },
  { href: "/dashboard/certification/testing", label: "E2E Validation" },
  { href: "/dashboard/certification/security", label: "Security" },
  { href: "/dashboard/certification/performance", label: "Performance" },
  { href: "/dashboard/certification/accessibility", label: "Accessibility" },
  { href: "/dashboard/certification/mobile", label: "Mobile" },
  { href: "/dashboard/certification/integrations", label: "Integrations" },
  { href: "/dashboard/certification/disaster-recovery", label: "Disaster Recovery" },
  { href: "/dashboard/certification/documentation", label: "Documentation" },
  { href: "/dashboard/certification/demo", label: "Demo" },
  { href: "/dashboard/certification/training", label: "Training" },
  { href: "/dashboard/certification/launch", label: "Launch Readiness" },
] as const;

export const E2E_WORKFLOWS: WorkflowTestDefinition[] = [
  { key: "admissions_enrollment", name: "Admissions → Enrollment", modules: ["admissions", "students"], table: "admissions_leads" },
  { key: "enrollment_ssis", name: "Enrollment → SSIS", modules: ["students", "ssis"], table: "students" },
  { key: "ssis_scheduling", name: "SSIS → Scheduling", modules: ["ssis", "scheduling"], table: "scheduling_sessions" },
  { key: "scheduling_teacher", name: "Scheduling → Teacher Workspace", modules: ["scheduling", "teacher"], table: "teacher_sessions" },
  { key: "teacher_parent", name: "Teacher Workspace → Parent Portal", modules: ["teacher", "portal"], table: "portal_messages" },
  { key: "parent_finance", name: "Parent Portal → Finance", modules: ["portal", "finance"], table: "finance_invoices" },
  { key: "finance_executive", name: "Finance → Executive Intelligence", modules: ["finance", "executive"], table: "executive_kpis" },
  { key: "executive_edi", name: "Executive Intelligence → Decision Intelligence", modules: ["executive", "edi"], table: "edi_decisions" },
  { key: "edi_compliance", name: "Decision Intelligence → Compliance", modules: ["edi", "compliance"], table: "compliance_items" },
  { key: "compliance_mc", name: "Compliance → Mission Control", modules: ["compliance", "mission_control"], table: "mission_control_items" },
  { key: "mc_cloud", name: "Mission Control → Cloud Platform", modules: ["mission_control", "cloud"], table: "cloud_customers" },
];

export const INTEGRATION_CHECKS = [
  { key: "quickbooks", name: "QuickBooks" },
  { key: "square", name: "Square" },
  { key: "google_workspace", name: "Google Workspace" },
  { key: "microsoft_365", name: "Microsoft 365" },
  { key: "google_calendar", name: "Google Calendar" },
  { key: "outlook", name: "Outlook" },
  { key: "nwea_map", name: "NWEA MAP" },
  { key: "smtp", name: "SMTP" },
  { key: "sms", name: "SMS" },
  { key: "webhooks", name: "Webhook Engine" },
  { key: "enterprise_data", name: "Enterprise Data Platform" },
];

export const MOBILE_VIEWPORTS = [
  { key: "desktop", device: "Desktop", width: 1920 },
  { key: "laptop", device: "Laptop", width: 1440 },
  { key: "tablet", device: "Tablet", width: 768 },
  { key: "iphone", device: "iPhone", width: 390 },
  { key: "android", device: "Android", width: 412 },
  { key: "foldable", device: "Foldable", width: 717 },
];

export const MOBILE_CHECK_AREAS = [
  "touch_targets", "navigation", "scrolling", "responsive_layouts",
  "forms", "tables", "charts", "dashboards",
] as const;

export const SCALABILITY_TIERS = [100, 500, 1000, 5000, 10000] as const;

export const PWA_CHECKS = [
  { key: "manifest", name: "Web App Manifest" },
  { key: "offline_shell", name: "Offline shell" },
  { key: "install_prompt", name: "Install prompt readiness" },
  { key: "icons", name: "App icons" },
  { key: "caching", name: "Service worker caching" },
  { key: "offline_behavior", name: "Offline behavior" },
  { key: "background_sync", name: "Background sync readiness" },
  { key: "push_notifications", name: "Push notification readiness" },
] as const;

export const READINESS_THRESHOLD = 85;

export const LAUNCH_DOMAINS = [
  { key: "security_score", label: "Security" },
  { key: "performance_score", label: "Performance" },
  { key: "accessibility_score", label: "Accessibility" },
  { key: "mobile_score", label: "Mobile" },
  { key: "pwa_score", label: "PWA" },
  { key: "testing_score", label: "Testing" },
  { key: "documentation_score", label: "Documentation" },
  { key: "training_score", label: "Training" },
  { key: "cloud_score", label: "Cloud Platform" },
  { key: "dr_score", label: "Disaster Recovery" },
  { key: "support_score", label: "Support Readiness" },
  { key: "integration_score", label: "Integration Health" },
  { key: "operational_score", label: "Operational Health" },
] as const;

export const HEALTH_DOMAINS = [
  "admissions", "ssis", "scheduling", "teacher_workspace", "finance", "hr",
  "compliance", "automation", "mission_control", "cloud", "enterprise_data",
] as const;

export function scoreToTrafficLight(score: number): TrafficLight {
  if (score >= READINESS_THRESHOLD) return "green";
  if (score >= READINESS_THRESHOLD - 15) return "yellow";
  return "red";
}
