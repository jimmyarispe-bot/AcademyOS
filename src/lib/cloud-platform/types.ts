export type CloudCustomerStatus = "trial" | "active" | "suspended" | "churned" | "onboarding";
export type CloudPlanKey = "free_trial" | "starter" | "professional" | "enterprise" | "custom";
export type CloudRiskLevel = "low" | "medium" | "high" | "critical";

export interface CloudHubSummary {
  totalCustomers: number;
  activeSubscriptions: number;
  openTickets: number;
  openIncidents: number;
  mrr: number;
  atRiskCustomers: number;
}

export const CLOUD_NAV = [
  { href: "/cloud", label: "Home", exact: true as const },
  { href: "/cloud/dashboard", label: "Dashboard" },
  { href: "/cloud/customers", label: "Customers" },
  { href: "/cloud/organizations", label: "Organizations" },
  { href: "/cloud/subscriptions", label: "Subscriptions" },
  { href: "/cloud/licenses", label: "Licenses" },
  { href: "/cloud/support", label: "Support" },
  { href: "/cloud/onboarding", label: "Onboarding" },
  { href: "/cloud/customer-success", label: "Customer Success" },
  { href: "/cloud/platform-health", label: "Platform Health" },
  { href: "/cloud/releases", label: "Releases" },
  { href: "/cloud/feature-flags", label: "Feature Flags" },
  { href: "/cloud/system-status", label: "System Status" },
  { href: "/cloud/analytics", label: "Analytics" },
  { href: "/cloud/billing", label: "Billing" },
  { href: "/cloud/invoices", label: "Invoices" },
  { href: "/cloud/contracts", label: "Contracts" },
  { href: "/cloud/marketplace", label: "Marketplace" },
  { href: "/cloud/deployments", label: "Deployments" },
  { href: "/cloud/incidents", label: "Incidents" },
  { href: "/cloud/audit", label: "Audit" },
  { href: "/cloud/settings", label: "Settings" },
] as const;

export const PROVISIONING_BLUEPRINTS = [
  { key: "standard", label: "Standard Academy", modules: ["admissions", "sis", "finance", "hr"] },
  { key: "enterprise", label: "Enterprise", modules: ["admissions", "sis", "finance", "hr", "executive", "compliance", "work"] },
  { key: "white_label", label: "White Label", modules: ["admissions", "sis", "finance"], whiteLabel: true },
] as const;

export const CLOUD_AI_READINESS = [
  "predict_churn",
  "recommend_upsells",
  "summarize_support_tickets",
  "identify_struggling_customers",
  "predict_storage_growth",
  "recommend_subscription_changes",
] as const;

export const CLOUD_EMPLOYEE_ROLES = [
  "super_admin", "engineering", "support", "customer_success", "sales", "finance", "operations",
] as const;
