import { createAuthClient } from "@/lib/supabase/server-auth";
import { getSecurityDashboardStats, getRecentSecurityEvents } from "@/lib/platform/identity/security";
import { getPendingApprovals } from "@/lib/platform/identity/approvals";
import type { ComplianceDashboardData } from "@/lib/platform/identity/types";

export async function getComplianceDashboard(): Promise<{
  stats: ComplianceDashboardData;
  recentSecurityEvents: Awaited<ReturnType<typeof getRecentSecurityEvents>>;
  pendingApprovals: Awaited<ReturnType<typeof getPendingApprovals>>;
}> {
  const supabase = await createAuthClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    securityStats,
    recentSecurityEvents,
    pendingApprovals,
    ferpaRes,
    missionFunding,
    expiringCerts,
  ] = await Promise.all([
    getSecurityDashboardStats(supabase),
    getRecentSecurityEvents(supabase, 15),
    getPendingApprovals(supabase, 20),
    supabase
      .from("platform_sensitive_access_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("platform_mission_control_items")
      .select("id", { count: "exact", head: true })
      .eq("is_resolved", false)
      .in("item_type", ["funding_alert", "scholarship_alert"]),
    supabase
      .from("employee_certifications")
      .select("id", { count: "exact", head: true })
      .lte("expiration_date", new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0])
      .gte("expiration_date", new Date().toISOString().split("T")[0]),
  ]);

  const stats: ComplianceDashboardData = {
    ferpaAccessCount: ferpaRes.count ?? 0,
    fundingAlerts: missionFunding.count ?? 0,
    scholarshipPending: pendingApprovals.filter((a) => a.module === "scholarships").length,
    securityEvents:
      securityStats.failedLogins +
      securityStats.permissionChanges +
      securityStats.sensitiveAccess,
    permissionChanges: securityStats.permissionChanges,
    expiringCertifications: expiringCerts.count ?? 0,
    pendingApprovals: pendingApprovals.length,
  };

  return { stats, recentSecurityEvents, pendingApprovals };
}
