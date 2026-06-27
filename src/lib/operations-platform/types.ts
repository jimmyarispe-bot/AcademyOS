export type SubscriptionTier = "trial" | "monthly" | "annual" | "enterprise" | "district" | "statewide" | "international";

export interface OperationsHubSummary {
  totalCustomers: number;
  activeSubscriptions: number;
  mrr: number;
  arr: number;
  openTickets: number;
  openIncidents: number;
  platformHealthPct: number;
  customerHealthPct: number;
  atRiskCustomers: number;
}

export interface ExecutiveOperationsSnapshot {
  organizationsCount: number;
  studentsManaged: number;
  employeesManaged: number;
  mrr: number;
  arr: number;
  churnPct: number;
  renewalsDue: number;
  platformHealthPct: number;
  supportHealthPct: number;
  customerHealthPct: number;
  marketplaceRevenue: number;
  implementationPipeline: number;
  forecastMrr: number;
}

export const OPS_NAV = [
  { href: "/operations", label: "Home", exact: true as const },
  { href: "/operations/dashboard", label: "Dashboard" },
  { href: "/operations/customers", label: "Customers" },
  { href: "/operations/customer-health", label: "Customer Success" },
  { href: "/operations/subscriptions", label: "Subscriptions" },
  { href: "/operations/billing", label: "Billing" },
  { href: "/operations/revenue", label: "Revenue" },
  { href: "/operations/support", label: "Support" },
  { href: "/operations/incidents", label: "Incidents" },
  { href: "/operations/platform", label: "Platform" },
  { href: "/operations/security", label: "Security" },
  { href: "/operations/monitoring", label: "Monitoring" },
  { href: "/operations/performance", label: "Performance" },
  { href: "/operations/deployments", label: "Deployments" },
  { href: "/operations/releases", label: "Releases" },
  { href: "/operations/backups", label: "Backups" },
  { href: "/operations/disaster-recovery", label: "Disaster Recovery" },
  { href: "/operations/licenses", label: "Licenses" },
  { href: "/operations/usage", label: "Usage" },
  { href: "/operations/analytics", label: "Analytics" },
  { href: "/operations/partners", label: "Partners" },
  { href: "/operations/marketplace", label: "Marketplace" },
  { href: "/operations/university", label: "University" },
] as const;

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  "trial", "monthly", "annual", "enterprise", "district", "statewide", "international",
];

export const UNIVERSITY_ROLE_PATHS = [
  "founder", "ceo", "school_leader", "admissions", "finance", "hr",
  "teacher", "therapist", "parent", "board_member",
] as const;

export const OPS_AI_READINESS = [
  "predict_churn",
  "recommend_customer_success_actions",
  "forecast_revenue",
  "detect_security_anomalies",
  "optimize_support_routing",
] as const;
