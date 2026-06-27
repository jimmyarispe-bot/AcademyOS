import { createAuthClient } from "@/lib/supabase/server-auth";
import { getMissionControlFeed } from "@/lib/platform/automation/mission-control";
import { getPlatformQueueMetrics } from "@/lib/platform/automation/queue";
import { getMarketplaceTemplates } from "@/lib/platform/automation/marketplace";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getMissionControlModulesForUser } from "@/lib/platform/identity/permissions";

export async function getMissionControlDashboard() {
  const supabase = await createAuthClient();
  const ctx = await getIdentityContext();

  if (!ctx) {
    return {
      feed: [],
      queueMetrics: {},
      marketplaceCount: 0,
      summary: { pendingTasks: 0, overdueTasks: 0, failedAutomations: 0, openItems: 0 },
      userRole: null,
      accessDenied: true,
    };
  }

  const canAccess =
    ctx.permissions.includes("mission_control.access") ||
    ctx.roles.some((r) => ["CEO", "FOUNDER", "EXECUTIVE_DIRECTOR"].includes(r));

  if (!canAccess) {
    return {
      feed: [],
      queueMetrics: {},
      marketplaceCount: 0,
      summary: { pendingTasks: 0, overdueTasks: 0, failedAutomations: 0, openItems: 0 },
      userRole: ctx.primaryRole,
      accessDenied: true,
    };
  }

  const allowedModules = await getMissionControlModulesForUser(supabase, ctx.effectiveUserId);
  const role = ctx.primaryRole ?? null;
  const schoolFilter =
    ctx.isEnterpriseAdmin || ctx.accessibleSchoolIds.length === 0
      ? undefined
      : ctx.accessibleSchoolIds;

  const [feed, queueMetrics, marketplace] = await Promise.all([
    getMissionControlFeed(supabase, {
      assignedRole: allowedModules === null ? undefined : role ?? undefined,
      allowedModules: allowedModules ?? undefined,
      accessibleSchoolIds: schoolFilter,
      limit: 30,
    }),
    getPlatformQueueMetrics(supabase),
    getMarketplaceTemplates(),
  ]);

  const pendingTasks = feed.filter((f) => f.item_type === "pending_task").length;
  const overdueTasks = feed.filter((f) => f.item_type === "overdue_task").length;
  const failedAutomations = feed.filter((f) => f.item_type === "failed_automation").length;

  return {
    feed,
    queueMetrics,
    marketplaceCount: marketplace.length,
    summary: {
      pendingTasks,
      overdueTasks,
      failedAutomations,
      openItems: feed.length,
    },
    userRole: role,
    accessDenied: false,
  };
}
